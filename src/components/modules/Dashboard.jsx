import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ShoppingCart, DollarSign, Package, ArrowRight, Coffee, Truck, BarChart2, ClipboardList, AlertTriangle, CheckCircle } from 'lucide-react';
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
        todayDeliveryFees: 0,
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

            // 1. Load critical data first (Sales & Revenue) - Fast
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endToday = new Date();
            endToday.setHours(23, 59, 59, 999);

            const [recentSalesData, allTodaySales] = await Promise.all([
                salesService.getAll(10),
                salesService.getByDateRange(today, endToday)
            ]);

            // Process Recent Sales
            const enrichedRecent = (recentSalesData || []).map((sale) => {
                const items = Array.isArray(sale.items) ? sale.items : [];
                const hasCold = items.some(it => it && it.isCold);
                const hasWholesale = items.some(it => it && !it.isCold);
                const type = hasCold && hasWholesale ? 'Atacado + Mercearia' : (hasCold ? 'Mercearia' : 'Atacado');
                return { ...sale, type };
            });
            setRecentSales(enrichedRecent);

            // Process Today's Stats
            const todayRevenue = allTodaySales.reduce((sum, sale) => sum + sale.total, 0);
            const todayDeliveryFees = allTodaySales.reduce((sum, sale) => sum + Number(sale.deliveryFeeValue || 0), 0);

            // Set initial stats (Low Stock will be 0 or cached initially)
            // Try to get cached low stock count if available
            let initialLowStockCount = 0;
            try {
                const cached = localStorage.getItem('pdv_low_stock_count');
                if (cached) initialLowStockCount = Number(cached);
            } catch { }

            setStats({
                todaySales: allTodaySales.length,
                todayRevenue,
                todayDeliveryFees,
                lowStockProducts: initialLowStockCount,
                openPresales: 0
            });

            setLoading(false); // <--- UNBLOCK UI HERE

            // 2. Load heavy data (Products for Low Stock) - Background
            setTimeout(async () => {
                try {
                    // Try to use cache first for products to avoid heavy network
                    let products = [];
                    try {
                        const cachedProds = JSON.parse(localStorage.getItem('pdv_products_cache') || 'null');
                        if (Array.isArray(cachedProds)) products = cachedProds;
                    } catch { }

                    // If no cache or we want to ensure freshness, we might need to fetch
                    // For dashboard, maybe we can rely on cache IF it exists, otherwise fetch
                    if (products.length === 0) {
                        products = await productService.getAll();
                        // Update cache
                        try { localStorage.setItem('pdv_products_cache', JSON.stringify(products)); } catch { }
                    } else {
                        // If we have cache, we can trigger a background refresh too, but maybe overkill for just this number
                        // Let's just use what we have or fetch if empty.
                        // Actually, to be accurate we should fetch, but let's do it quietly.
                        productService.getAll().then(fresh => {
                            if (fresh && fresh.length) {
                                // Recalculate with fresh data
                                calculateLowStock(fresh);
                                try { localStorage.setItem('pdv_products_cache', JSON.stringify(fresh)); } catch { }
                            }
                        }).catch(console.error);
                    }

                    calculateLowStock(products);

                } catch (err) {
                    console.error('Error loading background data:', err);
                }
            }, 100);

        } catch (error) {
            console.error('Error loading dashboard:', error);
            setLoading(false);
        }
    };

    const calculateLowStock = async (products) => {
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

        // Update stats with new count
        setStats(prev => ({
            ...prev,
            lowStockProducts: enrichedLowStock.length
        }));

        try { localStorage.setItem('pdv_low_stock_count', String(enrichedLowStock.length)); } catch { }
    };

    if (loading) {
        return <Loading message="Carregando dashboard..." />;
    }

    const today = new Date();
    const weekday = today.toLocaleDateString('pt-BR', { weekday: 'long' });
    const dateStr = today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textTransform: 'capitalize', marginBottom: '4px' }}>
                        {weekday}, {dateStr}
                    </div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>Painel</h1>
                </div>
                <Link to="/vendas" style={{ textDecoration: 'none' }}>
                    <button style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '12px 20px', borderRadius: '10px', border: 'none',
                        background: 'var(--gradient-primary)', color: '#fff',
                        fontWeight: 700, fontSize: '15px', cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(99,102,241,0.35)'
                    }}>
                        <ShoppingCart size={18} /> Nova Venda
                    </button>
                </Link>
            </div>

            {/* ── Stats Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                {[
                    {
                        label: 'Vendas Hoje',
                        value: stats.todaySales,
                        icon: <ShoppingCart size={22} color="#fff" />,
                        accent: '#6366f1',
                        bg: 'linear-gradient(135deg,#6366f1,#818cf8)',
                        format: v => String(v)
                    },
                    {
                        label: 'Faturamento Hoje',
                        value: stats.todayRevenue,
                        icon: <TrendingUp size={22} color="#fff" />,
                        accent: '#22c55e',
                        bg: 'linear-gradient(135deg,#22c55e,#4ade80)',
                        format: formatCurrency
                    },
                    {
                        label: 'Entregas Hoje',
                        value: stats.todayDeliveryFees,
                        icon: <Truck size={22} color="#fff" />,
                        accent: '#f59e0b',
                        bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)',
                        format: formatCurrency
                    },
                    {
                        label: 'Estoque Baixo',
                        value: stats.lowStockProducts,
                        icon: stats.lowStockProducts > 0 ? <AlertTriangle size={22} color="#fff" /> : <CheckCircle size={22} color="#fff" />,
                        accent: stats.lowStockProducts > 0 ? '#ef4444' : '#22c55e',
                        bg: stats.lowStockProducts > 0
                            ? 'linear-gradient(135deg,#ef4444,#f87171)'
                            : 'linear-gradient(135deg,#22c55e,#4ade80)',
                        format: v => String(v),
                        onClick: () => { if (stats.lowStockProducts > 0) setLowStockOpen(true); },
                        clickable: stats.lowStockProducts > 0
                    },
                ].map(card => (
                    <div
                        key={card.label}
                        onClick={card.onClick}
                        style={{
                            background: 'var(--color-bg-secondary)',
                            borderRadius: '14px',
                            padding: '20px',
                            border: '1px solid var(--color-border)',
                            cursor: card.clickable ? 'pointer' : 'default',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onMouseEnter={e => { if (card.clickable) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; } }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                    >
                        {/* accent bar */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: card.bg }} />
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: '4px' }}>
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                                    {card.label}
                                </div>
                                <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>
                                    {card.format(card.value)}
                                </div>
                            </div>
                            <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {card.icon}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Ações Rápidas + Vendas Recentes ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', alignItems: 'start' }}>

                {/* Ações Rápidas */}
                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                        Ações Rápidas
                    </div>
                    {[
                        { to: '/vendas',     icon: <ShoppingCart size={17} />, label: 'Nova Venda',         accent: '#6366f1', primary: true },
                        { to: '/pre-vendas', icon: <ClipboardList size={17} />, label: 'Nova Pré-Venda',    accent: '#3b82f6' },
                        { to: '/produtos',   icon: <Package size={17} />,       label: 'Produtos',          accent: '#22c55e' },
                        { to: '/financeiro', icon: <BarChart2 size={17} />,     label: 'Relatórios',        accent: '#f59e0b' },
                        { to: '/mesas',      icon: <Coffee size={17} />,        label: 'Mesas',             accent: '#8b5cf6' },
                    ].map(action => (
                        <Link key={action.to} to={action.to} style={{ textDecoration: 'none' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '11px 14px', borderRadius: '10px',
                                background: action.primary ? action.accent + '18' : 'transparent',
                                border: `1px solid ${action.primary ? action.accent + '44' : 'transparent'}`,
                                cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s'
                            }}
                                onMouseEnter={e => { e.currentTarget.style.background = action.accent + '18'; e.currentTarget.style.borderColor = action.accent + '44'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = action.primary ? action.accent + '18' : 'transparent'; e.currentTarget.style.borderColor = action.primary ? action.accent + '44' : 'transparent'; }}
                            >
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: action.accent + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.accent, flexShrink: 0 }}>
                                    {action.icon}
                                </div>
                                <span style={{ fontWeight: action.primary ? 700 : 500, fontSize: '14px', color: action.primary ? action.accent : 'var(--color-text-primary)' }}>
                                    {action.label}
                                </span>
                                <ArrowRight size={14} style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', opacity: 0.5 }} />
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Vendas Recentes */}
                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Vendas Recentes
                        </div>
                        <Link to="/financeiro" style={{ textDecoration: 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer' }}>
                                Ver todas <ArrowRight size={14} />
                            </div>
                        </Link>
                    </div>
                    {recentSales.length === 0 ? (
                        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <ShoppingCart size={40} style={{ opacity: 0.15, marginBottom: '10px' }} />
                            <p style={{ margin: 0 }}>Nenhuma venda registrada</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    {['Nº', 'Data/Hora', 'Cliente', 'Tipo', 'Total', 'Pagamento'].map(h => (
                                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recentSales.map((sale, i) => (
                                    <tr key={sale.id} style={{ borderBottom: i < recentSales.length - 1 ? '1px solid var(--color-divider)' : 'none', transition: 'background 0.1s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = ''}
                                    >
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '13px' }}>#{sale.saleNumber}</span>
                                        </td>
                                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                            {formatDateTime(sale.createdAt)}
                                        </td>
                                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>
                                            {sale.customerName || 'Cliente Padrão'}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{
                                                fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px',
                                                background: sale.type.includes('Mercearia') ? '#3b82f618' : '#6366f118',
                                                color: sale.type.includes('Mercearia') ? '#3b82f6' : '#6366f1'
                                            }}>
                                                {sale.type}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ fontWeight: 700, fontSize: '14px', color: '#22c55e' }}>{formatCurrency(sale.total)}</span>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', background: '#22c55e18', color: '#22c55e' }}>
                                                {sale.paymentMethod || 'Dinheiro'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

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
