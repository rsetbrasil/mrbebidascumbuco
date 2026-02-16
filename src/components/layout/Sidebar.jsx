import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    Home,
    ShoppingCart,
    Package,
    Users,
    Wallet,
    ClipboardList,
    BarChart3,
    Settings,
    Sun,
    Moon,
    Coffee
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

const Sidebar = ({ onClose }) => {
    const { isManager, user } = useAuth();
    const { settings, theme, toggleTheme } = useApp();

    const baseMenu = {
        pdv: { path: '/sales', icon: ShoppingCart, label: 'PDV' },
        products: { path: '/products', icon: Package, label: 'Produtos' },
        customers: { path: '/customers', icon: Users, label: 'Clientes' },
        sales: { path: '/sales-history', icon: ClipboardList, label: 'Vendas' },
        presales: { path: '/presales', icon: ClipboardList, label: 'Pré-vendas' },
        tables: { path: '/tables', icon: Coffee, label: 'Mesas' },
        financial: { path: '/financial', icon: BarChart3, label: 'Financeiro', restricted: true },
        cashRegister: { path: '/cash-register', icon: Wallet, label: 'Caixa', restricted: true },
        settings: { path: '/settings', icon: Settings, label: 'Configurações', restricted: true },
        dashboard: { path: '/', icon: Home, label: 'Painel', restricted: true }
    };

    const pref = Array.isArray(settings?.menu) ? settings.menu : null;
    const orderPref = pref ? new Map(pref.map((item, idx) => [item.key, idx])) : null;
    let menuItems = Object.entries(baseMenu).map(([key, def]) => ({ key, visible: true, ...def }));
    const visibility = pref ? new Map(pref.map(item => [item.key, item.visible !== false])) : null;
    if (visibility) {
        menuItems = menuItems.map(it => ({ ...it, visible: visibility.has(it.key) ? visibility.get(it.key) : true }));
    }
    const defaultOrder = [
        'dashboard',
        'pdv',
        'products',
        'customers',
        'sales',
        'presales',
        'tables',
        'financial',
        'cashRegister',
        'settings'
    ];
    menuItems = menuItems.sort((a, b) => {
        if (orderPref) {
            const ia = orderPref.has(a.key) ? orderPref.get(a.key) : Number.MAX_SAFE_INTEGER;
            const ib = orderPref.has(b.key) ? orderPref.get(b.key) : Number.MAX_SAFE_INTEGER;
            if (ia !== ib) return ia - ib;
        }
        const ia = defaultOrder.indexOf(a.key);
        const ib = defaultOrder.indexOf(b.key);
        const va = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
        const vb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
        return va - vb;
    });

    const cashierAllowed = ['cashRegister'];
    const filteredItems = menuItems.filter(item => {
        if (!item.visible) return false;
        if (!item.restricted) return true;
        if (isManager) return true;
        if (user?.role === 'cashier' && cashierAllowed.includes(item.key)) return true;
        return false;
    });

    const handleNavClick = () => {
        if (onClose) onClose();
    };

    return (
        <aside style={{
            width: '280px',
            background: 'var(--color-bg-secondary)',
            borderRight: '1px solid var(--color-border)',
            height: '100dvh',
            position: 'sticky',
            top: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Logo/Brand */}
            <div style={{
                padding: 'var(--spacing-xl)',
                borderBottom: '1px solid var(--color-border)',
                flexShrink: 0
            }}>
                <h2 style={{
                    fontSize: 'var(--font-size-xl)',
                    fontWeight: 700,
                    background: 'var(--gradient-primary)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    margin: 0
                }}>
                    PDV MR Bebidas
                </h2>
            </div>

            {/* Navigation */}
            <nav style={{
                flex: 1,
                padding: 'var(--spacing-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xs)',
                overflowY: 'auto',
                minHeight: 0
            }}>
                {filteredItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={handleNavClick}
                        style={({ isActive }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-md)',
                            padding: 'var(--spacing-md)',
                            borderRadius: 'var(--radius-md)',
                            color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                            textDecoration: 'none',
                            transition: 'all var(--transition-fast)',
                            fontWeight: isActive ? 600 : 500
                        })}
                        onMouseEnter={(e) => {
                            if (!e.currentTarget.getAttribute('aria-current')) {
                                e.currentTarget.style.background = 'var(--color-bg-hover)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!e.currentTarget.getAttribute('aria-current')) {
                                e.currentTarget.style.background = 'transparent';
                            }
                        }}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Theme Toggle & Footer */}
            <div style={{
                padding: 'var(--spacing-md)',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-sm)',
                flexShrink: 0
            }}>
                <button
                    onClick={toggleTheme}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--spacing-sm)',
                        padding: 'var(--spacing-sm)',
                        background: 'var(--color-bg-tertiary)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--color-text-primary)',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-sm)',
                        width: '100%',
                        transition: 'all var(--transition-fast)'
                    }}
                >
                    {settings?.theme === 'light' || theme === 'light' ? (
                        <>
                            <Moon size={18} />
                            <span>Modo Escuro</span>
                        </>
                    ) : (
                        <>
                            <Sun size={18} />
                            <span>Modo Claro</span>
                        </>
                    )}
                </button>

                <div style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-muted)',
                    textAlign: 'center'
                }}>
                    © 2024 MR Bebidas
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
