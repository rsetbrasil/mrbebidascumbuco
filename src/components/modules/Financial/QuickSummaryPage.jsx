import React, { useEffect, useMemo, useState } from 'react';
import Card from '../../common/Card';
import Loading from '../../common/Loading';
import Input from '../../common/Input';
import Button from '../../common/Button';
import { DollarSign, TrendingUp, Truck } from 'lucide-react';
import { salesService, productService } from '../../../services/firestore';
import { formatCurrency } from '../../../utils/formatters';
import { useApp } from '../../../contexts/AppContext';

const QuickSummaryPage = () => {
    const { showNotification, currentCashRegister } = useApp();
    const [loading, setLoading] = useState(false);
    const [period, setPeriod] = useState('today');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.toISOString().slice(0, 10);
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setHours(23, 59, 59, 999);
        return d.toISOString().slice(0, 10);
    });
    const [metrics, setMetrics] = useState({ totalGross: 0, totalFees: 0, profit: 0 });
    const [isMobile, setIsMobile] = useState(false);

    const range = useMemo(() => {
        const now = new Date();
        if (period === 'today') {
            const s = new Date();
            s.setHours(0, 0, 0, 0);
            const e = new Date();
            e.setHours(23, 59, 59, 999);
            return { s, e };
        }
        if (period === 'yesterday') {
            const s = new Date(now);
            s.setDate(now.getDate() - 1);
            s.setHours(0, 0, 0, 0);
            const e = new Date(now);
            e.setDate(now.getDate() - 1);
            e.setHours(23, 59, 59, 999);
            return { s, e };
        }
        const s = new Date(startDate + 'T00:00:00');
        const e = new Date(endDate + 'T23:59:59');
        return { s, e };
    }, [period, startDate, endDate]);

    const loadData = async () => {
        try {
            setLoading(true);
            let sales;
            if (period === 'current' && currentCashRegister && currentCashRegister.id) {
                sales = await salesService.getByCashRegister(currentCashRegister.id);
            } else {
                sales = await salesService.getByDateRange(range.s, range.e);
            }
            const valid = (sales || []).filter(s => s && s.status !== 'cancelled');

            const unitCostByKey = new Map();
            const neededProductIds = new Set();
            for (const sale of valid) {
                const items = Array.isArray(sale?.items) ? sale.items : [];
                for (const it of items) {
                    const itemCost = Number(it?.unitCost);
                    if (!Number.isFinite(itemCost) || itemCost <= 0) {
                        const pid = String(it?.productId || it?.id || '');
                        if (pid) neededProductIds.add(pid);
                    }
                }
            }
            const productsMap = new Map();
            if (neededProductIds.size > 0) {
                const ids = Array.from(neededProductIds);
                const pairs = await Promise.all(ids.map(async (id) => {
                    try {
                        const p = await productService.getById(id);
                        return [id, p || null];
                    } catch {
                        return [id, null];
                    }
                }));
                for (const [id, p] of pairs) productsMap.set(id, p);
            }
            const computeUnitCost = (sale, item) => {
                const itemCost = Number(item?.unitCost);
                if (Number.isFinite(itemCost) && itemCost > 0) return itemCost;
                const productId = String(item?.productId || item?.id || '');
                if (!productId) return 0;
                const hasUnit = !!item?.unit && Number(item?.unit?.multiplier) > 0;
                const unitMultiplier = hasUnit ? Number(item.unit.multiplier) : 1;
                const isCold = !!item?.isCold;
                const isWholesale = !!item?.isWholesale;
                const cacheKey = `${productId}|cold:${isCold}|wh:${isWholesale}|unit:${hasUnit ? unitMultiplier : 0}`;
                if (unitCostByKey.has(cacheKey)) return unitCostByKey.get(cacheKey);
                const product = productsMap.get(productId);
                if (!product) {
                    const fallback = Number.isFinite(itemCost) ? itemCost : 0;
                    unitCostByKey.set(cacheKey, fallback);
                    return fallback;
                }
                const rawCost = Number(isCold ? (product?.coldCost || product?.cost || 0) : (product?.cost || 0));
                const packMultiplier = Number(isCold ? (product?.coldUnitMultiplier || 1) : (product?.wholesaleUnitMultiplier || 1));
                const baseCost = packMultiplier > 0 ? (rawCost / packMultiplier) : rawCost;
                let computed = 0;
                if (hasUnit) {
                    computed = baseCost * unitMultiplier;
                } else if (isCold || isWholesale) {
                    computed = rawCost;
                } else {
                    computed = baseCost;
                }
                unitCostByKey.set(cacheKey, computed);
                return computed;
            };

            let totalGross = 0;
            let totalFees = 0;
            let productsRevenue = 0;
            let totalCMV = 0;
            for (const sale of valid) {
                const gross = Number(sale?.total || 0);
                const fee = Number(sale?.deliveryFeeValue || 0);
                const products = sale?.productsTotal !== undefined ? Number(sale.productsTotal || 0) : Math.max(0, gross - fee);
                const items = Array.isArray(sale?.items) ? sale.items : [];
                let cmv = 0;
                for (const it of items) {
                    const unitCost = computeUnitCost(sale, it);
                    cmv += Number(unitCost || 0) * Number(it?.quantity || 0);
                }
                totalGross += gross;
                totalFees += fee;
                productsRevenue += products;
                totalCMV += cmv;
            }
            const profit = productsRevenue - totalCMV;
            setMetrics({ totalGross, totalFees, profit });
        } catch (e) {
            showNotification('Erro ao carregar resumo', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period, startDate, endDate]);

    useEffect(() => {
        const check = () => {
            if (typeof window !== 'undefined') {
                setIsMobile(window.matchMedia('(max-width: 768px)').matches);
            }
        };
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    return (
        <div style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 'var(--spacing-md)', flexDirection: isMobile ? 'column' : 'row' }}>
                <h1 style={{ margin: 0 }}>Resumo</h1>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    flexWrap: 'wrap',
                    width: isMobile ? '100%' : 'auto'
                }}>
                    <Button size={isMobile ? 'sm' : 'md'} style={isMobile ? { flex: '1 1 30%', minWidth: 0 } : undefined} variant={period === 'today' ? 'primary' : 'secondary'} onClick={() => setPeriod('today')}>Hoje</Button>
                    <Button size={isMobile ? 'sm' : 'md'} style={isMobile ? { flex: '1 1 30%', minWidth: 0 } : undefined} variant={period === 'yesterday' ? 'primary' : 'secondary'} onClick={() => setPeriod('yesterday')}>Ontem</Button>
                    <Button size={isMobile ? 'sm' : 'md'} style={isMobile ? { flex: '1 1 30%', minWidth: 0 } : undefined} variant={period === 'range' ? 'primary' : 'secondary'} onClick={() => setPeriod('range')}>Período</Button>
                    <Button size={isMobile ? 'sm' : 'md'} style={isMobile ? { flex: '1 1 30%', minWidth: 0 } : undefined} variant={period === 'current' ? 'primary' : 'secondary'} onClick={() => setPeriod('current')} disabled={!currentCashRegister || !currentCashRegister.id}>Caixa Atual</Button>
                    {period === 'range' && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, auto)',
                            gap: 'var(--spacing-sm)',
                            width: isMobile ? '100%' : 'auto'
                        }}>
                            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={isMobile ? { width: '100%' } : undefined} />
                            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={isMobile ? { width: '100%' } : undefined} />
                            <Button size={isMobile ? 'sm' : 'md'} onClick={loadData} style={isMobile ? { width: '100%' } : undefined}>Atualizar</Button>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <Loading />
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)' }}>
                    <Card>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                            <div style={{ padding: 'var(--spacing-md)', background: 'rgba(34,197,94,0.1)', borderRadius: 'var(--radius-lg)' }}>
                                <DollarSign style={{ color: 'var(--color-success)' }} size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Total Vendido</div>
                                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xl)' }}>{formatCurrency(metrics.totalGross)}</div>
                            </div>
                        </div>
                    </Card>
                    <Card>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                            <div style={{ padding: 'var(--spacing-md)', background: 'rgba(59,130,246,0.1)', borderRadius: 'var(--radius-lg)' }}>
                                <TrendingUp style={{ color: 'var(--color-primary)' }} size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Lucro</div>
                                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xl)' }}>{formatCurrency(metrics.profit)}</div>
                            </div>
                        </div>
                    </Card>
                    <Card>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                            <div style={{ padding: 'var(--spacing-md)', background: 'rgba(234,88,12,0.1)', borderRadius: 'var(--radius-lg)' }}>
                                <Truck style={{ color: '#ea580c' }} size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Taxa de Entrega</div>
                                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xl)' }}>{formatCurrency(metrics.totalFees)}</div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default QuickSummaryPage;
