import React, { useEffect, useMemo, useState } from 'react';
import Loading from '../../common/Loading';
import Input from '../../common/Input';
import { DollarSign, TrendingUp, Truck, PieChart } from 'lucide-react';
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

    const periodButtons = [
        { key: 'today', label: 'Hoje' },
        { key: 'yesterday', label: 'Ontem' },
        { key: 'range', label: 'Período' },
        { key: 'current', label: 'Caixa Atual', disabled: !currentCashRegister || !currentCashRegister.id },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '16px' }}>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <PieChart size={14} /> Resumo financeiro
                    </div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>Resumo</h1>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                    {periodButtons.map(btn => (
                        <button
                            key={btn.key}
                            onClick={() => !btn.disabled && setPeriod(btn.key)}
                            disabled={btn.disabled}
                            style={{
                                padding: '7px 16px',
                                borderRadius: '20px',
                                border: period === btn.key ? 'none' : '1px solid var(--color-border)',
                                background: period === btn.key ? 'var(--gradient-primary)' : 'transparent',
                                color: period === btn.key ? '#fff' : 'var(--color-text-secondary)',
                                fontWeight: 600,
                                fontSize: '13px',
                                cursor: btn.disabled ? 'not-allowed' : 'pointer',
                                opacity: btn.disabled ? 0.45 : 1,
                                transition: 'all 0.15s',
                                whiteSpace: 'nowrap',
                                flex: isMobile ? '1 1 auto' : undefined
                            }}
                        >
                            {btn.label}
                        </button>
                    ))}
                    {period === 'range' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            <button
                                onClick={loadData}
                                style={{ padding: '7px 16px', borderRadius: '10px', border: 'none', background: 'var(--gradient-primary)', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                            >
                                Atualizar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <Loading />
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
                    {[
                        { label: 'Total Vendido', value: metrics.totalGross, icon: DollarSign, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
                        { label: 'Lucro Estimado', value: metrics.profit, icon: TrendingUp, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
                        { label: 'Taxa de Entrega', value: metrics.totalFees, icon: Truck, color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
                    ].map(card => (
                        <div key={card.label} style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <card.icon size={22} color={card.color} />
                            </div>
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{card.label}</div>
                                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px' }}>{formatCurrency(card.value)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default QuickSummaryPage;
