import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ShoppingCart, DollarSign, Package, ArrowRight } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import Loading from '../common/Loading';
import Modal from '../common/Modal';
import Input from '../common/Input';
import { useApp } from '../../contexts/AppContext';
import { salesService, productService, presalesService } from '../../services/firestore';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

const Dashboard = () => {
    const { currentCashRegister } = useApp();
    const [stats, setStats] = useState({
        todaySales: 0,
        todayRevenue: 0,
        lowStockProducts: 0,
        openPresales: 0
    });
    const [recentSales, setRecentSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lowStockOpen, setLowStockOpen] = useState(false);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [adjustments, setAdjustments] = useState({});
    const [updatingId, setUpdatingId] = useState(null);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);

            // Load recent sales
            const recentSalesData = await salesService.getAll(10);
            const enrichedRecent = (recentSalesData || []).map((sale) => {
                const items = Array.isArray(sale.items) ? sale.items : [];
                const hasCold = items.some(it => it && it.isCold);
                const hasWholesale = items.some(it => it && !it.isCold);
                const type = hasCold && hasWholesale ? 'Atacado + Mercearia' : (hasCold ? 'Mercearia' : 'Atacado');
                return { ...sale, type };
            });
            setRecentSales(enrichedRecent);

            // Calculate today's stats
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endToday = new Date();
            endToday.setHours(23, 59, 59, 999);

            const allTodaySales = await salesService.getByDateRange(today, endToday);
            const todayRevenue = allTodaySales.reduce((sum, sale) => sum + sale.total, 0);

            const products = await productService.getAll();
            const lowStock = products.filter(p => {
                const toNum = (v) => {
                    const n = Number(v ?? 0);
                    return Number.isFinite(n) ? n : 0;
                };
                const min = toNum(p.minStock || 0);
                const aAvailRaw = toNum(p.stock) - toNum(p.reservedStock);
                const mAvailRaw = toNum(p.coldStock) - toNum(p.reservedColdStock);
                const aAvail = Math.max(0, aAvailRaw);
                const mAvail = Math.max(0, mAvailRaw);
                return (aAvail <= min) || (mAvail <= min) || (aAvail <= 0) || (mAvail <= 0);
            });

            const aMap = new Map();
            const mMap = new Map();
            try {
                const pendingPresales = await presalesService.getByStatus('pending');
                (pendingPresales || []).forEach(ps => {
                    const customerName = ps.customerName || 'Cliente';
                    const items = Array.isArray(ps.items) ? ps.items : [];
                    items.forEach(it => {
                        const pid = it?.productId;
                        if (!pid) return;
                        if (it?.isCold) {
                            const set = mMap.get(pid) || new Set();
                            set.add(customerName);
                            mMap.set(pid, set);
                        } else {
                            const set = aMap.get(pid) || new Set();
                            set.add(customerName);
                            aMap.set(pid, set);
                        }
                    });
                });
            } catch {
            }

            const enrichedLowStock = lowStock
                .map(p => ({
                    ...p,
                    reservedWholesaleNames: Array.from(aMap.get(p.id) || []),
                    reservedColdNames: Array.from(mMap.get(p.id) || [])
                }))
                .sort((a, b) => {
                    const an = String(a.name || '').toLowerCase();
                    const bn = String(b.name || '').toLowerCase();
                    if (an < bn) return -1;
                    if (an > bn) return 1;
                    return 0;
                });
            setLowStockItems(enrichedLowStock);

            setStats({
                todaySales: allTodaySales.length,
                todayRevenue,
                lowStockProducts: enrichedLowStock.length,
                openPresales: 0
            });

        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <Loading message="Carregando dashboard..." />;
    }

    return (
        <div className="fade-in">
            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <h1>Painel</h1>
                <p style={{ color: 'var(--color-text-muted)' }}>
                    Visão geral do sistema
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-4" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                                Vendas Hoje
                            </p>
                            <h2 style={{ margin: '8px 0 0 0', fontSize: 'var(--font-size-3xl)' }}>
                                {stats.todaySales}
                            </h2>
                        </div>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: 'var(--radius-lg)',
                            background: 'var(--gradient-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <ShoppingCart size={30} color="white" />
                        </div>
                    </div>
                </Card>

                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                                Faturamento Hoje
                            </p>
                            <h2 style={{ margin: '8px 0 0 0', fontSize: 'var(--font-size-3xl)' }}>
                                {formatCurrency(stats.todayRevenue)}
                            </h2>
                        </div>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: 'var(--radius-lg)',
                            background: 'var(--gradient-success)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <TrendingUp size={30} color="white" />
                        </div>
                    </div>
                </Card>

                <Card>
                    <div
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        onClick={() => { if (stats.lowStockProducts > 0) setLowStockOpen(true); }}
                    >
                        <div>
                            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                                Estoque Baixo
                            </p>
                            <h2 style={{ margin: '8px 0 0 0', fontSize: 'var(--font-size-3xl)' }}>
                                {stats.lowStockProducts}
                            </h2>
                        </div>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: 'var(--radius-lg)',
                            background: stats.lowStockProducts > 0 ? 'var(--color-warning)' : 'var(--color-success)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: stats.lowStockProducts > 0 ? 'pointer' : 'default'
                        }}>
                            <Package size={30} color="white" />
                        </div>
                    </div>
                </Card>

                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                                Status do Caixa
                            </p>
                            <h2 style={{ margin: '8px 0 0 0', fontSize: 'var(--font-size-xl)' }}>
                                {currentCashRegister ? 'Aberto' : 'Fechado'}
                            </h2>
                        </div>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: 'var(--radius-lg)',
                            background: currentCashRegister ? 'var(--color-success)' : 'var(--color-danger)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <DollarSign size={30} color="white" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Quick Actions */}
            <Card title="Ações Rápidas" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <div className="grid grid-4">
                    <Link to="/sales" style={{ textDecoration: 'none' }}>
                        <Button variant="primary" style={{ width: '100%' }}>
                            <ShoppingCart size={20} />
                            Nova Venda
                        </Button>
                    </Link>
                    <Link to="/presales" style={{ textDecoration: 'none' }}>
                        <Button variant="secondary" style={{ width: '100%' }}>
                            Nova Pré-Venda
                        </Button>
                    </Link>
                    <Link to="/products" style={{ textDecoration: 'none' }}>
                        <Button variant="secondary" style={{ width: '100%' }}>
                            Gerenciar Produtos
                        </Button>
                    </Link>
                    <Link to="/financial" style={{ textDecoration: 'none' }}>
                        <Button variant="secondary" style={{ width: '100%' }}>
                            Relatórios
                        </Button>
                    </Link>
                </div>
            </Card>

            {/* Recent Sales */}
            <Card
                title="Vendas Recentes"
                headerAction={
                    <Link to="/financial">
                        <Button variant="secondary" size="sm">
                            Ver Todas <ArrowRight size={16} />
                        </Button>
                    </Link>
                }
            >
                {recentSales.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--spacing-xl)' }}>
                        Nenhuma venda registrada
                    </p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Número</th>
                                    <th>Data</th>
                                    <th>Cliente</th>
                                    <th>Tipo</th>
                                    <th>Total</th>
                                    <th>Pagamento</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentSales.map(sale => (
                                    <tr key={sale.id}>
                                        <td><strong>{sale.saleNumber}</strong></td>
                                        <td>{formatDateTime(sale.createdAt)}</td>
                                        <td>{sale.customerName || 'Cliente Padrão'}</td>
                                        <td>{sale.type}</td>
                                        <td><strong>{formatCurrency(sale.total)}</strong></td>
                                        <td>
                                            <span className="badge badge-success">
                                                {sale.paymentMethod || 'Dinheiro'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Modal
                isOpen={lowStockOpen}
                onClose={() => { setLowStockOpen(false); setAdjustments({}); }}
                title="Produtos com Estoque Baixo"
                size="lg"
            >
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th>Estoque</th>
                                <th>Mercearia</th>
                                <th>Reservas</th>
                                <th>Mínimo</th>
                                <th style={{ textAlign: 'right' }}>Ajustar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lowStockItems.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        Nenhum produto com estoque baixo
                                    </td>
                                </tr>
                            ) : (
                                lowStockItems.map((p) => {
                                    const current = adjustments[p.id] || { stock: p.stock ?? 0, coldStock: p.coldStock ?? 0, minStock: p.minStock || 0 };
                                    return (
                                        <tr key={p.id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{p.name}</div>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{p.barcode || 'Sem código'}</div>
                                            </td>
                                            <td style={{ width: '160px' }}>
                                                <Input
                                                    type="number"
                                                    inputMode="numeric"
                                                    step="1"
                                                    min="0"
                                                    value={current.stock}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setAdjustments(prev => ({ ...prev, [p.id]: { ...current, stock: val } }));
                                                    }}
                                                />
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                                    {p.wholesaleUnit || p.unitOfMeasure || 'UN'}
                                                </div>
                                            </td>
                                            <td style={{ width: '160px' }}>
                                                <Input
                                                    type="number"
                                                    inputMode="numeric"
                                                    step="1"
                                                    min="0"
                                                    value={current.coldStock}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setAdjustments(prev => ({ ...prev, [p.id]: { ...current, coldStock: val } }));
                                                    }}
                                                />
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                                    {p.coldUnit || p.unitOfMeasure || 'UN'}
                                                </div>
                                            </td>
                                            <td style={{ width: '160px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)' }}>
                                                        Atacado: {Number(p.reservedStock ?? 0)}
                                                    </span>
                                                    {(() => {
                                                        const names = Array.isArray(p.reservedWholesaleNames) ? p.reservedWholesaleNames.filter(n => {
                                                            const s = String(n || '').trim().toLowerCase();
                                                            return s !== '' && s !== 'sss';
                                                        }) : [];
                                                        return names.length > 0;
                                                    })() && (
                                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                            {Array.isArray(p.reservedWholesaleNames)
                                                                ? p.reservedWholesaleNames
                                                                    .filter(n => {
                                                                        const s = String(n || '').trim().toLowerCase();
                                                                        return s !== '' && s !== 'sss';
                                                                    })
                                                                    .join(', ')
                                                                : ''}
                                                        </span>
                                                    )}
                                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)' }}>
                                                        Mercearia: {Number(p.reservedColdStock ?? 0)}
                                                    </span>
                                                    {(() => {
                                                        const names = Array.isArray(p.reservedColdNames) ? p.reservedColdNames.filter(n => {
                                                            const s = String(n || '').trim().toLowerCase();
                                                            return s !== '' && s !== 'sss';
                                                        }) : [];
                                                        return names.length > 0;
                                                    })() && (
                                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                            {Array.isArray(p.reservedColdNames)
                                                                ? p.reservedColdNames
                                                                    .filter(n => {
                                                                        const s = String(n || '').trim().toLowerCase();
                                                                        return s !== '' && s !== 'sss';
                                                                    })
                                                                    .join(', ')
                                                                : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ width: '160px' }}>
                                                <Input
                                                    type="number"
                                                    value={current.minStock}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setAdjustments(prev => ({ ...prev, [p.id]: { ...current, minStock: val } }));
                                                    }}
                                                />
                                            </td>
                                            <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                                                <Button
                                                    size="sm"
                                                    loading={updatingId === p.id}
                                                    onClick={async () => {
                                                        const payload = adjustments[p.id] || { stock: p.stock ?? 0, coldStock: p.coldStock ?? 0, minStock: p.minStock || 0 };
                                                        setUpdatingId(p.id);
                                                        try {
                                                            await productService.update(p.id, {
                                                                stock: Math.max(0, Number.parseInt(payload.stock, 10) || 0),
                                                                coldStock: Math.max(0, Number.parseInt(payload.coldStock, 10) || 0),
                                                                minStock: Math.max(0, Number.parseInt(payload.minStock, 10) || 0)
                                                            });
                                                            await loadDashboardData();
                                                        } catch (err) {
                                                        } finally {
                                                            setUpdatingId(null);
                                                        }
                                                    }}
                                                >
                                                    Salvar
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Modal>
        </div>
    );
};

export default Dashboard;
