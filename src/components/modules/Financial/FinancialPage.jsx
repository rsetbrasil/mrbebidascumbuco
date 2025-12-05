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
import { DollarSign, TrendingUp, ShoppingBag, CreditCard } from 'lucide-react';
import Card from '../../common/Card';
import Loading from '../../common/Loading';
import { salesService, categoryService } from '../../../services/firestore';
import { formatCurrency } from '../../../utils/formatters';
import { useApp } from '../../../contexts/AppContext';

const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444'];

const FinancialPage = () => {
    const { showNotification } = useApp();
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState([]);
    const [categories, setCategories] = useState({});
    const [metrics, setMetrics] = useState({
        totalSales: 0,
        totalOrders: 0,
        avgTicket: 0,
        topPaymentMethod: '-'
    });
    const [chartData, setChartData] = useState({
        daily: [],
        byCategory: [],
        byPayment: []
    });

    const [dateFilter, setDateFilter] = useState('month');
    const [dateRange, setDateRange] = useState({ start: null, end: null });

    useEffect(() => {
        loadData();
    }, [dateFilter]);

    const getDatesFromFilter = (filter) => {
        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);

        // Set end to end of day
        end.setHours(23, 59, 59, 999);

        switch (filter) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                break;
            case 'week':
                // Start of week (Sunday)
                start.setDate(now.getDate() - now.getDay());
                start.setHours(0, 0, 0, 0);
                break;
            case 'month':
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                break;
            case 'year':
                start.setMonth(0, 1);
                start.setHours(0, 0, 0, 0);
                break;
            default:
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
        }

        return { start, end };
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const { start, end } = getDatesFromFilter(dateFilter);
            setDateRange({ start, end });

            const [salesData, categoriesData] = await Promise.all([
                salesService.getByDateRange(start, end),
                categoryService.getAll()
            ]);

            setSales(salesData);

            const catMap = {};
            categoriesData.forEach(c => catMap[c.id] = c.name);
            setCategories(catMap);

            processMetrics(salesData, catMap);
        } catch (error) {
            console.error('Error loading financial data:', error);
            showNotification('Erro ao carregar dados financeiros', 'error');
        } finally {
            setLoading(false);
        }
    };

    const processMetrics = (data, catMap) => {
        if (!data.length) {
            setMetrics({
                totalSales: 0,
                totalOrders: 0,
                avgTicket: 0,
                topPaymentMethod: '-',
                totalProfit: 0,
                profitMargin: 0
            });
            setChartData({ daily: [], byCategory: [], byPayment: [] });
            return;
        }

        // Basic Metrics
        const totalSales = data.reduce((acc, curr) => acc + curr.total, 0);
        const totalOrders = data.length;
        const avgTicket = totalSales / totalOrders;

        // Calculate Profit
        let totalCost = 0;
        data.forEach(sale => {
            if (sale.items) {
                sale.items.forEach(item => {
                    const cost = item.unitCost || 0;
                    totalCost += cost * item.quantity;
                });
            }
        });
        const totalProfit = totalSales - totalCost;
        const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

        // Payment Methods
        const paymentCounts = {};
        data.forEach(sale => {
            const method = sale.paymentMethod;
            paymentCounts[method] = (paymentCounts[method] || 0) + 1;
        });
        const topPaymentMethod = Object.entries(paymentCounts)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

        setMetrics({
            totalSales,
            totalOrders,
            avgTicket,
            topPaymentMethod,
            totalProfit,
            profitMargin
        });

        // Chart Data: Daily Sales (Last 7 days or selected range)
        const dailyMap = {};
        // Initialize map based on filter
        if (dateFilter === 'today') {
            // For today, maybe show hours? For now keeping simple
            const dateStr = new Date().toLocaleDateString('pt-BR').slice(0, 5);
            dailyMap[dateStr] = 0;
        } else {
            // Initialize range
            const curr = new Date(dateRange.start || getDatesFromFilter(dateFilter).start);
            const end = new Date(dateRange.end || getDatesFromFilter(dateFilter).end);

            // Limit to max 30 days for chart readability if needed, but for now iterate
            // If range is year, maybe group by month? 
            // Keeping logic simple: map existing dates from data + fill gaps if small range

            // Simplified: Just map the sales dates
        }

        data.forEach(sale => {
            const date = new Date(sale.createdAt.toDate ? sale.createdAt.toDate() : sale.createdAt);
            const dateStr = date.toLocaleDateString('pt-BR').slice(0, 5);
            dailyMap[dateStr] = (dailyMap[dateStr] || 0) + sale.total;
        });

        const dailyData = Object.entries(dailyMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => {
                // Simple sort by date string DD/MM
                const [d1, m1] = a.name.split('/').map(Number);
                const [d2, m2] = b.name.split('/').map(Number);
                return m1 - m2 || d1 - d2;
            });

        // Chart Data: By Category
        const catSales = {};
        data.forEach(sale => {
            sale.items.forEach(item => {
                const catName = catMap[item.categoryId] || 'Outros';
                catSales[catName] = (catSales[catName] || 0) + (item.unitPrice * item.quantity);
            });
        });

        const byCategoryData = Object.entries(catSales)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        // Chart Data: By Payment Method
        const paymentSales = {};
        data.forEach(sale => {
            const method = sale.paymentMethod;
            paymentSales[method] = (paymentSales[method] || 0) + sale.total;
        });

        const byPaymentData = Object.entries(paymentSales).map(([name, value]) => ({
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

    const FilterButton = ({ label, value }) => (
        <button
            onClick={() => setDateFilter(value)}
            style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: dateFilter === value ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                color: dateFilter === value ? '#fff' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.2s'
            }}
        >
            {label}
        </button>
    );

    return (
        <div className="fade-in">
            <div style={{ marginBottom: 'var(--spacing-xl)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1>Relatórios Financeiros</h1>
                    <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--spacing-xs)' }}>
                        Visão geral do desempenho do seu negócio
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                    <FilterButton label="Hoje" value="today" />
                    <FilterButton label="Semana" value="week" />
                    <FilterButton label="Mês" value="month" />
                    <FilterButton label="Ano" value="year" />
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-1 md:grid-3 lg:grid-6" style={{ marginBottom: 'var(--spacing-xl)', gap: 'var(--spacing-md)' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                        <div style={{
                            padding: 'var(--spacing-md)',
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <DollarSign style={{ color: 'var(--color-success)' }} size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
                                Faturamento
                            </p>
                            <h3 style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-xl)' }}>
                                {formatCurrency(metrics.totalSales)}
                            </h3>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                        <div style={{
                            padding: 'var(--spacing-md)',
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <TrendingUp style={{ color: 'var(--color-success)' }} size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
                                Lucro Bruto
                            </p>
                            <h3 style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-xl)' }}>
                                {formatCurrency(metrics.totalProfit)}
                            </h3>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                        <div style={{
                            padding: 'var(--spacing-md)',
                            background: 'rgba(59, 130, 246, 0.1)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <TrendingUp style={{ color: '#3b82f6' }} size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
                                Margem
                            </p>
                            <h3 style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-xl)' }}>
                                {(metrics.profitMargin || 0).toFixed(1)}%
                            </h3>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                        <div style={{
                            padding: 'var(--spacing-md)',
                            background: 'rgba(99, 102, 241, 0.1)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <ShoppingBag style={{ color: 'var(--color-primary)' }} size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
                                Vendas
                            </p>
                            <h3 style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-xl)' }}>
                                {metrics.totalOrders}
                            </h3>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                        <div style={{
                            padding: 'var(--spacing-md)',
                            background: 'rgba(139, 92, 246, 0.1)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <TrendingUp style={{ color: '#8b5cf6' }} size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
                                Ticket Médio
                            </p>
                            <h3 style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-xl)' }}>
                                {formatCurrency(metrics.avgTicket)}
                            </h3>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                        <div style={{
                            padding: 'var(--spacing-md)',
                            background: 'rgba(236, 72, 153, 0.1)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <CreditCard style={{ color: 'var(--color-secondary)' }} size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
                                Top Pagto
                            </p>
                            <h3 style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-lg)', textTransform: 'capitalize' }}>
                                {metrics.topPaymentMethod}
                            </h3>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-2" style={{ gap: 'var(--spacing-xl)' }}>
                <Card title="Vendas dos Últimos 7 Dias">
                    <div style={{ height: '320px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData.daily}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#6366f1"
                                    strokeWidth={3}
                                    dot={{ fill: '#6366f1' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card title="Vendas por Categoria">
                    <div style={{ height: '320px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData.byCategory}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {chartData.byCategory.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card title="Vendas por Forma de Pagamento" style={{ gridColumn: 'span 2' }}>
                    <div style={{ height: '320px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.byPayment}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Bar dataKey="value" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default FinancialPage;
