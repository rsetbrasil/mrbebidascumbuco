import React, { useState, useEffect } from 'react';
import { ArrowLeft, Printer, Calendar, User, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Loading from '../../common/Loading';
import Input from '../../common/Input';
import { cashRegisterService, salesService, productService } from '../../../services/firestore';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { printCashRegisterReport } from '../../../utils/receiptPrinter';
import { useApp } from '../../../contexts/AppContext';

const CashRegisterHistoryPage = () => {
    const navigate = useNavigate();
    const { showNotification, settings } = useApp();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState('');

    useEffect(() => {
        loadHistory();
    }, []);

    const enrichSalesCosts = async (salesList) => {
        const productCache = new Map();
        const unitCostByKey = new Map();

        const getProduct = async (productId) => {
            const key = String(productId || '');
            if (!key) return null;
            if (productCache.has(key)) return productCache.get(key);
            try {
                const product = await productService.getById(key);
                productCache.set(key, product || null);
                return product || null;
            } catch {
                productCache.set(key, null);
                return null;
            }
        };

        const computeUnitCost = async (sale, item) => {
            const productId = String(item?.productId || '');
            if (!productId) return Number(item?.unitCost || 0);

            const unitMultiplier = item?.unit && item.unit.multiplier ? Number(item.unit.multiplier) : 1;
            const isCold = item?.isCold === true || (sale?.priceType === 'cold' && item?.isCold !== false);
            const cacheKey = `${productId}|${isCold ? 'cold' : 'wholesale'}|${unitMultiplier}`;
            if (unitCostByKey.has(cacheKey)) return unitCostByKey.get(cacheKey);

            const product = await getProduct(productId);
            if (!product) {
                const fallback = Number(item?.unitCost || 0);
                unitCostByKey.set(cacheKey, fallback);
                return fallback;
            }

            const rawCost = Number(isCold ? (product?.coldCost || product?.cost || 0) : (product?.cost || 0));
            const costUnitMultiplier = Number(isCold ? (product?.coldUnitMultiplier || 1) : (product?.wholesaleUnitMultiplier || 1));
            const baseCost = costUnitMultiplier > 0 ? (rawCost / costUnitMultiplier) : rawCost;
            const computed = baseCost * (Number.isFinite(unitMultiplier) && unitMultiplier > 0 ? unitMultiplier : 1);
            unitCostByKey.set(cacheKey, computed);
            return computed;
        };

        const list = Array.isArray(salesList) ? salesList : [];
        return Promise.all(list.map(async (sale) => {
            const items = Array.isArray(sale?.items) ? sale.items : [];
            if (items.length === 0) return sale;
            const enrichedItems = await Promise.all(items.map(async (item) => {
                const unitCost = await computeUnitCost(sale, item);
                return { ...item, unitCost };
            }));
            const cmvTotal = enrichedItems.reduce((acc, it) => {
                const qty = Number(it?.quantity || 0);
                const unitCost = Number(it?.unitCost || 0);
                return acc + (unitCost * qty);
            }, 0);
            return { ...sale, items: enrichedItems, cmvTotal };
        }));
    };

    const loadHistory = async () => {
        try {
            let data;
            if (filterDate) {
                const base = new Date(`${filterDate}T00:00:00`);
                const start = new Date(base);
                const end = new Date(base);
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                data = await cashRegisterService.getByDateRange(start, end);
            } else {
                data = await cashRegisterService.getHistory();
            }
            setHistory(data);
        } catch (error) {
            console.error('Error loading history:', error);
            showNotification('Erro ao carregar histórico', 'error');
        } finally {
            setLoading(false);
        }
    };
    
    const handleApplyFilter = async () => {
        setLoading(true);
        await loadHistory();
    };

    const handlePrintReport = async (register) => {
        try {
            const sales = await salesService.getByCashRegister(register.id);
            const validSales = await enrichSalesCosts((sales || []).filter(s => s && s.status !== 'cancelled'));
            const totalSales = validSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
            const movements = await cashRegisterService.getMovements(register.id);
            const totalSupplies = (movements || [])
                .filter(m => m.type === 'supply')
                .reduce((acc, m) => acc + Number(m.amount || 0), 0);
            const totalBleeds = (movements || [])
                .filter(m => m.type === 'bleed')
                .reduce((acc, m) => acc + Number(m.amount || 0), 0);
            const totalChange = (movements || [])
                .filter(m => m.type === 'change')
                .reduce((acc, m) => acc + Number(m.amount || 0), 0);
            const finalBalance = Number(register.openingBalance || 0) + totalSales + totalSupplies - totalBleeds;
            const totalCost = validSales.reduce((sum, s) => {
                const items = Array.isArray(s.items) ? s.items : [];
                const cost = items.reduce((acc, it) => acc + (Number(it.unitCost || 0) * Number(it.quantity || 0)), 0);
                return sum + cost;
            }, 0);
            const totalProfit = Math.max(0, totalSales - totalCost);
            const profitCalc = (() => {
                let atacado = 0;
                let mercearia = 0;
                for (const sale of validSales) {
                    const items = Array.isArray(sale.items) ? sale.items : [];
                    for (const item of items) {
                        const unitPrice = Number(item.unitPrice || 0);
                        const unitCost = Number(item.unitCost || 0);
                        const qty = Number(item.quantity || 1);
                        const lucroItem = (unitPrice - unitCost) * qty;
                        if (item.isWholesale === true) {
                            atacado += lucroItem;
                        } else {
                            mercearia += lucroItem;
                        }
                    }
                }
                return { atacado, mercearia, total: atacado + mercearia };
            })();

            printCashRegisterReport({
                openedAt: register.openedAt,
                closedAt: register.closedAt,
                closedBy: register.closedBy || 'Admin',
                openingBalance: register.openingBalance,
                totalSales,
                totalCost,
                totalProfit,
                totalSupplies,
                totalBleeds,
                totalChange,
                finalBalance,
                difference: register.difference,
                notes: register.notes,
                profitAtacado: profitCalc.atacado,
                profitMercearia: profitCalc.mercearia,
                profitTotal: profitCalc.total
            }, settings || {});
        } catch (error) {
            console.error('Error printing report:', error);
            showNotification('Erro ao gerar relatório', 'error');
        }
    };

    const handleViewDetails = (registerId) => {
        navigate(`/cash-register-details/${registerId}`);
    };

    if (loading) return <Loading fullScreen />;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/cash-register')}
                        icon={ArrowLeft}
                    >
                        Voltar
                    </Button>
                    <h1 className="text-2xl font-bold text-white">Histórico de Caixas</h1>
                </div>
                <div className="flex items-center gap-3">
                    <Input
                        label="Filtrar por data de fechamento"
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="min-w-[240px]"
                    />
                    <Button variant="secondary" onClick={handleApplyFilter}>
                        Aplicar
                    </Button>
                    <Button variant="ghost" onClick={() => { setFilterDate(''); setLoading(true); loadHistory(); }}>
                        Limpar
                    </Button>
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-700 text-gray-400">
                                <th className="p-4" style={{minWidth: 180}}>Data</th>
                                <th className="p-4" style={{minWidth: 200}}>Operador</th>
                                <th className="p-4" style={{minWidth: 140}}>Saldo Inicial</th>
                                <th className="p-4" style={{minWidth: 140}}>Saldo Final</th>
                                <th className="p-4" style={{minWidth: 140}}>Diferença</th>
                                <th className="p-4 text-right" style={{minWidth: 220}}>Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-400">
                                        Nenhum registro encontrado
                                    </td>
                                </tr>
                            ) : (
                                history.map((register) => (
                                    <tr key={register.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4 text-white align-top">
                                            <div className="flex items-start gap-2">
                                                <Calendar size={16} className="text-emerald-400 mt-0.5" />
                                                <div>
                                                    <div className="font-medium">{formatDateTime(register.closedAt)}</div>
                                                    <div className="text-gray-400 text-sm">Abertura: {formatDateTime(register.openedAt)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-300 align-top">
                                            <div className="flex items-start gap-2">
                                                <User size={16} className="text-blue-400 mt-0.5" />
                                                <div className="break-words">{register.closedBy || '-'}</div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-300">
                                            {formatCurrency(register.openingBalance)}
                                        </td>
                                        <td className="p-4 font-medium text-emerald-400">
                                            {formatCurrency(register.closingBalance)}
                                        </td>
                                        <td className="p-4">
                                            {(() => {
                                                const diff = Number(register.difference || 0);
                                                const label = diff === 0 ? 'Sem diferença' : diff > 0 ? 'Sobra' : 'Falta';
                                                const color = diff === 0 ? 'var(--color-text-muted)'
                                                    : diff > 0 ? 'var(--color-success)'
                                                    : 'var(--color-danger)';
                                                return (
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '2px 8px',
                                                        borderRadius: '9999px',
                                                        background: 'rgba(148, 163, 184, 0.15)',
                                                        color,
                                                        fontWeight: 600
                                                    }}>
                                                        {label}{diff !== 0 ? ` ${formatCurrency(diff)}` : ''}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleViewDetails(register.id)}
                                                >
                                                    Ver
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    icon={Printer}
                                                    onClick={() => handlePrintReport(register)}
                                                >
                                                    Imprimir
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default CashRegisterHistoryPage;
