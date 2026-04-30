import React, { useState, useEffect } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { DollarSign, TrendingUp, ShoppingBag, CreditCard, Printer, FileText, Truck, BarChart3 } from 'lucide-react';
import Loading from '../../common/Loading';
import { salesService, categoryService, productService } from '../../../services/firestore';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { printCashRegisterReport } from '../../../utils/receiptPrinter';
import { printDetailedAuditReport } from '../../../utils/printerExtensions';
import { useApp } from '../../../contexts/AppContext';

const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444'];

const FinancialPage = () => {
    const { showNotification } = useApp();
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState([]);
    const [categories, setCategories] = useState({});
    const [productsMap, setProductsMap] = useState({});
    const [metrics, setMetrics] = useState({
        totalSales: 0,
        totalSalesProducts: 0,
        totalDeliveryFees: 0,
        totalOrders: 0,
        avgTicket: 0,
        topPaymentMethod: '-',
        totalCMV: 0,
        profit: 0,
        margin: 0
    });
    const [chartData, setChartData] = useState({
        daily: [],
        byCategory: [],
        byPayment: []
    });

    const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth())); // 0-11 or 'all'
    const [filterYear, setFilterYear] = useState(String(new Date().getFullYear())); // Year or 'all'
    const [filterDay, setFilterDay] = useState('all'); // 1-31 or 'all'
    const [dateRange, setDateRange] = useState({ start: null, end: null });

    const months = [
        { value: '0', label: 'Janeiro' },
        { value: '1', label: 'Fevereiro' },
        { value: '2', label: 'Março' },
        { value: '3', label: 'Abril' },
        { value: '4', label: 'Maio' },
        { value: '5', label: 'Junho' },
        { value: '6', label: 'Julho' },
        { value: '7', label: 'Agosto' },
        { value: '8', label: 'Setembro' },
        { value: '9', label: 'Outubro' },
        { value: '10', label: 'Novembro' },
        { value: '11', label: 'Dezembro' }
    ];

    const years = [
        { value: '2026', label: '2026' },
        { value: '2025', label: '2025' },
        { value: '2024', label: '2024' }
    ];

    // Generate days based on selected month/year
    const getDaysInMonth = (year, month) => {
        if (year === 'all' || month === 'all') return [];
        const days = new Date(Number(year), Number(month) + 1, 0).getDate();
        return Array.from({ length: days }, (_, i) => String(i + 1));
    };

    const days = getDaysInMonth(filterYear, filterMonth);

    useEffect(() => {
        loadData();
    }, [filterMonth, filterYear, filterDay]);

    const getDatesFromSelection = () => {
        const start = new Date();
        const end = new Date();
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        if (filterYear === 'all') {
            start.setFullYear(2023, 0, 1); // Reasonable start for all-time
            // end is today
            return { start, end };
        }

        const y = Number(filterYear);
        if (filterMonth === 'all') {
            start.setFullYear(y, 0, 1);
            end.setFullYear(y, 11, 31);
        } else {
            const m = Number(filterMonth);

            if (filterDay !== 'all') {
                const d = Number(filterDay);
                start.setFullYear(y, m, d);
                start.setHours(0, 0, 0, 0);
                end.setFullYear(y, m, d);
                end.setHours(23, 59, 59, 999);
            } else {
                start.setFullYear(y, m, 1);
                start.setHours(0, 0, 0, 0);
                end.setFullYear(y, m + 1, 0);
                end.setHours(23, 59, 59, 999);
            }
        }

        return { start, end };
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const { start, end } = getDatesFromSelection();
            setDateRange({ start, end });

            const [salesData, categoriesData, productsData] = await Promise.all([
                salesService.getByDateRange(start, end),
                categoryService.getAll(),
                productService.getAll()
            ]);

            setSales(salesData);

            const catMap = {};
            categoriesData.forEach(c => catMap[c.id] = c.name);
            setCategories(catMap);

            const prodMap = {};
            productsData.forEach(p => prodMap[p.id] = p);
            setProductsMap(prodMap);

            processMetrics(salesData, catMap, prodMap);
        } catch (error) {
            console.error('Error loading financial data:', error);
            showNotification('Erro ao carregar dados financeiros', 'error');
        } finally {
            setLoading(false);
        }
    };

    const normalizePayments = (sale) => {
        if (Array.isArray(sale.payments) && sale.payments.length > 0) {
            return sale.payments.map(p => ({
                method: p.method,
                amount: Number(p.amount || 0)
            }));
        }
        return [{ method: sale.paymentMethod || 'Dinheiro', amount: Number(sale.total || 0) }];
    };

    const [detailedStats, setDetailedStats] = useState([]);

    // ... existing loadData ...

    const processMetrics = (data, catMap, prodMap) => {
        if (!data.length) {
            setMetrics({
                totalSales: 0,
                totalSalesProducts: 0,
                totalDeliveryFees: 0,
                totalOrders: 0,
                avgTicket: 0,
                topPaymentMethod: '-',
                totalCMV: 0,
                profit: 0,
                margin: 0
            });
            setChartData({ daily: [], byCategory: [], byPayment: [] });
            setDetailedStats([]);
            return;
        }

        const totalSales = data.reduce((acc, curr) => acc + Number(curr.total || 0), 0);
        const totalDeliveryFees = data.reduce((acc, curr) => acc + Number(curr.deliveryFeeValue || 0), 0);
        const totalSalesProducts = data.reduce((acc, curr) => {
            const fee = Number(curr.deliveryFeeValue || 0);
            const products = curr.productsTotal !== undefined ? Number(curr.productsTotal || 0) : (Number(curr.total || 0) - fee);
            return acc + Math.max(0, products);
        }, 0);
        const totalCMV = data.reduce((acc, curr) => acc + Number(curr.cmvTotal || 0), 0);
        const totalOrders = data.length;
        const avgTicket = totalSales / totalOrders;
        const profit = totalSalesProducts - totalCMV;
        const margin = totalSalesProducts > 0 ? (profit / totalSalesProducts) : 0;

        const paymentCounts = {};
        const paymentTotals = {};

        // Detailed Stats Map
        const detailedMap = {};

        let revenueAtacado = 0;
        let costAtacado = 0;
        let revenueMercearia = 0;
        let costMercearia = 0;

        const approxEq = (a, b) => {
            const na = Number(a || 0);
            const nb = Number(b || 0);
            return Math.abs(na - nb) < 0.005;
        };

        data.forEach(sale => {
            // Payments
            const list = normalizePayments(sale);
            list.forEach(p => {
                const method = String(p.method || 'Dinheiro');
                paymentCounts[method] = (paymentCounts[method] || 0) + 1;
                paymentTotals[method] = (paymentTotals[method] || 0) + Number(p.amount || 0);
            });

            // Calculate Profit Split
            const items = Array.isArray(sale.items) ? sale.items : [];
            items.forEach(item => {
                const qty = Number(item.quantity || 0);
                const unitPrice = Number(item.unitPrice || 0);

                // Fallback for cost if missing in item
                let unitCost = Number(item.unitCost);
                if (isNaN(unitCost) || unitCost === 0) {
                    // Try to find product and use current cost
                    const prod = prodMap && (prodMap[item.productId || item.id]);
                    if (prod) {
                        // Determine if it was likely Atacado or Mercearia based on price approximation, or default
                        // But strictly we should use the cost corresponding to the sale type if we can determine it.
                        // However, item.isWholesale / item.isCold is the truth.

                        const isCold = item.isCold || (sale.priceType === 'cold');
                        // Use the cost that matches the sale type
                        if (isCold) {
                            unitCost = Number(prod.coldCost || prod.cost || 0);
                        } else {
                            unitCost = Number(prod.cost || 0);
                        }

                        // Handle bundles/multipliers if unit is present?
                        // If item.unit exists, unitCost in item should have been calculated.
                        // If we are falling back to product cost, we are getting "base cost".
                        // If the item quantity is in base units, base cost is fine.
                        // If item was separate unit... accessing prod directly gives base cost.
                        // Assuming quantity stored in item is always normalized or we don't have enough info to reconstruct complex units perfectly without more logic.
                        // For now, simpler fallback:
                        if (item.unit && item.unit.multiplier) {
                            unitCost = unitCost * item.unit.multiplier;
                        }
                    }
                }
                unitCost = unitCost || 0;

                const totalLine = Number(item.total || (unitPrice * qty));
                const totalCostLine = unitCost * qty;

                // Determine type
                let isAtacado = false;
                if (!item.isCold && item.wholesalePrice && approxEq(unitPrice, item.wholesalePrice)) {
                    isAtacado = true;
                } else if (item.isWholesale) {
                    isAtacado = true;
                } else if (!item.isCold && sale.priceType === 'wholesale') {
                    isAtacado = true;
                }

                if (isAtacado) {
                    revenueAtacado += totalLine;
                    costAtacado += totalCostLine;
                } else {
                    revenueMercearia += totalLine;
                    costMercearia += totalCostLine;
                }
            });

            // Daily/Monthly Stats
            const date = new Date(sale.createdAt.toDate ? sale.createdAt.toDate() : sale.createdAt);
            const dateStr = date.toLocaleDateString('pt-BR'); // DD/MM/YYYY

            if (!detailedMap[dateStr]) {
                detailedMap[dateStr] = {
                    date: dateStr,
                    rawDate: date,
                    count: 0,
                    revenue: 0,
                    cost: 0
                };
            }
            detailedMap[dateStr].count += 1;
            const fee = Number(sale.deliveryFeeValue || 0);
            const productsRevenue = sale.productsTotal !== undefined ? Number(sale.productsTotal || 0) : (Number(sale.total || 0) - fee);
            detailedMap[dateStr].revenue += Math.max(0, productsRevenue);
            detailedMap[dateStr].cost += Number(sale.cmvTotal || 0);
        });

        const topPaymentMethod = Object.entries(paymentTotals)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

        const profitAtacado = revenueAtacado - costAtacado;
        const profitMercearia = revenueMercearia - costMercearia;

        // Force totals to match the calculated splits (which include the cost fallbacks)
        const calculatedTotalCMV = costAtacado + costMercearia;
        const calculatedTotalProfit = profitAtacado + profitMercearia;

        setMetrics({
            totalSales,
            totalSalesProducts,
            totalDeliveryFees,
            totalOrders,
            avgTicket,
            topPaymentMethod,
            totalCMV: calculatedTotalCMV,
            profit: calculatedTotalProfit,
            margin: totalSalesProducts > 0 ? (calculatedTotalProfit / totalSalesProducts) : 0,
            profitAtacado,
            profitMercearia
        });

        // Produce Detailed List
        const detailedList = Object.values(detailedMap).map(d => ({
            ...d,
            profit: d.revenue - d.cost,
            margin: d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue) : 0
        })).sort((a, b) => b.rawDate - a.rawDate);

        setDetailedStats(detailedList);

        // Chart Data: Daily Sales
        // Use detailedList for graph to ensure consistency
        const dailyData = detailedList.slice().reverse().map(d => ({
            name: d.date.slice(0, 5), // DD/MM
            value: d.revenue
        }));

        // ... existing Category logic ...
        const catSales = {};
        data.forEach(sale => {
            sale.items.forEach(item => {
                const catName = catMap[item.categoryId] || 'Outros';
                catSales[catName] = (catSales[catName] || 0) + (Number(item.unitPrice || 0) * Number(item.quantity || 0));
            });
        });

        const byCategoryData = Object.entries(catSales)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const byPaymentData = Object.entries(paymentTotals).map(([name, value]) => ({
            name,
            value
        }));

        setChartData({
            daily: dailyData,
            byCategory: byCategoryData,
            byPayment: byPaymentData
        });
    };

    if (loading) return <Loading />;

    const handlePrint = () => {
        if (!metrics.totalSales && !chartData.daily.length) {
            showNotification('Sem dados para imprimir', 'info');
            return;
        }

        const { start, end } = dateRange.start ? dateRange : getDatesFromSelection();
        const periodStr = filterYear === 'all'
            ? 'Todo o Período'
            : (filterMonth === 'all'
                ? `Ano de ${filterYear}`
                : `${months[Number(filterMonth)].label} de ${filterYear}`);

        // Prepare data for receipt
        const printData = {
            reportTitle: 'RELATÓRIO FINANCEIRO',
            isGenericReport: true,
            periodStr: periodStr,

            // Financial Summary
            openingBalance: 0, // Not applicable for sales report
            totalSales: metrics.totalSales,
            totalDeliveryFees: metrics.totalDeliveryFees,
            totalSupplies: 0,
            totalBleeds: 0,
            totalChange: 0, // Could calculate if needed
            finalBalance: metrics.totalSales, // For now assuming total sales is the balance

            // Payments
            paymentSummary: chartData.byPayment.map(p => ({
                method: p.name,
                amount: p.value,
                count: 0 // Optional, count not tracked in simple summary
            })),

            // Profit
            // Profit
            profitTotal: metrics.profit,
            profitAtacado: metrics.profitAtacado || 0,
            profitMercearia: metrics.profitMercearia || 0,
            totalProfit: metrics.profit,

            notes: `Margem: ${(metrics.margin * 100).toFixed(1)}% | Ticket Médio: ${formatCurrency(metrics.avgTicket)} | Taxas de entrega: ${formatCurrency(metrics.totalDeliveryFees)} (fora do lucro)`
        };

        printCashRegisterReport(printData);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <BarChart3 size={14} /> Visão geral do desempenho do negócio
                    </div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>Relatórios Financeiros</h1>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                    <button
                        onClick={() => printDetailedAuditReport(sales)}
                        style={{
                            padding: '10px 14px',
                            background: 'rgba(239, 68, 68, 0.1)', // Red tint for audit
                            border: '1px solid var(--color-danger)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--color-danger)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginRight: '8px'
                        }}
                        title="Auditoria de Lucros (Detalhado)"
                    >
                        <FileText size={18} />
                    </button>

                    <button
                        onClick={handlePrint}
                        style={{
                            padding: '10px 14px',
                            background: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--color-text-primary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginRight: '8px'
                        }}
                        title="Imprimir Relatório"
                    >
                        <Printer size={18} />
                    </button>

                    {/* Day Select (Visible only if month is selected) */}
                    {days.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <select
                                value={filterDay}
                                onChange={(e) => setFilterDay(e.target.value)}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-bg-secondary)',
                                    color: 'var(--color-text-primary)',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    minWidth: '80px'
                                }}
                            >
                                <option value="all">Dia: Todos</option>
                                {days.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Month Select */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <select
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            style={{
                                padding: '10px 14px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-primary)',
                                outline: 'none',
                                cursor: 'pointer',
                                minWidth: '130px'
                            }}
                        >
                            <option value="all">Todos os Meses</option>
                            {months.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Year Select */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            style={{
                                padding: '10px 14px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-primary)',
                                outline: 'none',
                                cursor: 'pointer',
                                minWidth: '100px'
                            }}
                        >
                            <option value="all">Todos</option>
                            {years.map(y => (
                                <option key={y.value} value={y.value}>{y.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                {[
                    { label: 'Faturamento',   value: formatCurrency(metrics.totalSales),         icon: DollarSign,  color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
                    { label: 'Taxas Entrega', value: formatCurrency(metrics.totalDeliveryFees),  icon: Truck,       color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                    { label: 'Vendas',        value: metrics.totalOrders,                        icon: ShoppingBag, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
                    { label: 'Ticket Médio',  value: formatCurrency(metrics.avgTicket),          icon: TrendingUp,  color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
                    { label: 'Top Pagto',     value: metrics.topPaymentMethod,                   icon: CreditCard,  color: '#ec4899', bg: 'rgba(236,72,153,0.1)', textTransform: 'capitalize' },
                    { label: 'CMV',           value: formatCurrency(metrics.totalCMV),           icon: DollarSign,  color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                    { label: 'Lucro',         value: formatCurrency(metrics.profit),             icon: TrendingUp,  color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                    { label: 'Margem',        value: `${(metrics.margin * 100).toFixed(1)}%`,    icon: TrendingUp,  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                ].map(card => (
                    <div key={card.label} style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <card.icon size={20} color={card.color} />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{card.label}</div>
                            <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', textTransform: card.textTransform }}>{card.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '20px' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '16px' }}>Vendas dos Últimos 7 Dias</div>
                    <div style={{ height: '300px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData.daily}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '20px' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '16px' }}>Vendas por Categoria</div>
                    <div style={{ height: '300px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={chartData.byCategory} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {chartData.byCategory.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '20px', gridColumn: 'span 2' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '16px' }}>Vendas por Forma de Pagamento</div>
                    <div style={{ height: '300px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.byPayment}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                                <Bar dataKey="value" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Detailed Tables */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 700, fontSize: '14px' }}>Detalhamento Financeiro</div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    {['Data', 'Vendas', 'Faturamento', 'Custo (CMV)', 'Lucro', 'Margem'].map((h, i) => (
                                        <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        Use o filtro de datas para ver o detalhamento.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 700, fontSize: '14px' }}>Detalhamento por Pagamento</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>Método</th>
                                <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chartData.byPayment.length === 0 ? (
                                <tr><td colSpan="2" style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Sem dados</td></tr>
                            ) : chartData.byPayment.map((item) => (
                                <tr key={item.name} style={{ borderBottom: '1px solid var(--color-divider)', transition: 'background 0.1s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                                    <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: '14px', textTransform: 'capitalize' }}>{item.name}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.value)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FinancialPage;
