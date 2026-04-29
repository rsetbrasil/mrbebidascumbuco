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
    PieChart,
    Settings,
    Sun,
    Moon,
    Coffee,
    Truck,
    History
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

const Sidebar = ({ onClose }) => {
    const { isManager, user } = useAuth();
    const { settings, theme, toggleTheme } = useApp();

    const baseMenu = {
        dashboard:           { path: '/',                  icon: Home,          label: 'Painel',           restricted: true  },
        pdv:                 { path: '/vendas',            icon: ShoppingCart,  label: 'PDV'                                 },
        sales:               { path: '/historico-vendas',  icon: History,       label: 'Vendas'                              },
        presales:            { path: '/pre-vendas',        icon: ClipboardList, label: 'Pré-vendas'                          },
        cashRegister:        { path: '/caixa',             icon: Wallet,        label: 'Caixa',            restricted: true  },
        products:            { path: '/produtos',          icon: Package,       label: 'Produtos'                            },
        customers:           { path: '/clientes',          icon: Users,         label: 'Clientes'                            },
        financial:           { path: '/financeiro',        icon: BarChart3,     label: 'Financeiro',       restricted: true  },
        tables:              { path: '/mesas',             icon: Coffee,        label: 'Mesas'                               },
        quickSummary:        { path: '/resumo',            icon: PieChart,      label: 'Resumo'                              },
        internalConsumption: { path: '/consumo-interno',   icon: Package,       label: 'Consumo Interno',  restricted: true  },
        cashAudit:           { path: '/auditoria-caixa',   icon: ClipboardList, label: 'Auditoria',        restricted: true  },
        deliveryFees:        { path: '/taxas-entrega',     icon: Truck,         label: 'Taxas Entrega',    restricted: true  },
        settings:            { path: '/configuracoes',     icon: Settings,      label: 'Configurações',    restricted: true  },
    };

    const pref = Array.isArray(settings?.menu) ? settings.menu : null;
    const orderPref = pref ? new Map(pref.map((item, idx) => [item.key, idx])) : null;
    let menuItems = Object.entries(baseMenu).map(([key, def]) => ({ key, visible: true, ...def }));
    const visibility = pref ? new Map(pref.map(item => [item.key, item.visible !== false])) : null;
    if (visibility) {
        menuItems = menuItems.map(it => ({ ...it, visible: visibility.has(it.key) ? visibility.get(it.key) : true }));
    }
    const defaultOrder = ['dashboard','pdv','sales','presales','cashRegister','products','customers','financial','tables','quickSummary','internalConsumption','cashAudit','deliveryFees','settings'];
    menuItems = menuItems.sort((a, b) => {
        if (orderPref) {
            const ia = orderPref.has(a.key) ? orderPref.get(a.key) : Number.MAX_SAFE_INTEGER;
            const ib = orderPref.has(b.key) ? orderPref.get(b.key) : Number.MAX_SAFE_INTEGER;
            if (ia !== ib) return ia - ib;
        }
        const ia = defaultOrder.indexOf(a.key);
        const ib = defaultOrder.indexOf(b.key);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    const cashierAllowed = ['cashRegister'];
    const filteredItems = menuItems.filter(item => {
        if (!item.visible) return false;
        if (!item.restricted) return true;
        if (isManager) return true;
        if (user?.role === 'cashier' && cashierAllowed.includes(item.key)) return true;
        return false;
    });

    const settingsItem = filteredItems.find(i => i.key === 'settings');
    const navItems = filteredItems.filter(i => i.key !== 'settings');

    const handleNavClick = () => { if (onClose) onClose(); };

    const iconColors = {
        dashboard:           '#6366f1',
        pdv:                 '#10b981',
        sales:               '#3b82f6',
        presales:            '#8b5cf6',
        cashRegister:        '#f59e0b',
        products:            '#ec4899',
        customers:           '#14b8a6',
        financial:           '#22c55e',
        tables:              '#f97316',
        quickSummary:        '#06b6d4',
        internalConsumption: '#84cc16',
        cashAudit:           '#a78bfa',
        deliveryFees:        '#fb923c',
        settings:            '#94a3b8',
    };

    return (
        <aside style={{
            width: '240px',
            background: 'var(--color-bg-secondary)',
            borderRight: '1px solid var(--color-border)',
            height: '100dvh',
            position: 'sticky',
            top: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Logo */}
            <div style={{ height: '64px', padding: '0 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div>
                    <div style={{ fontSize: '16px', fontWeight: 800, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.2 }}>
                        MR Bebidas
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        Sistema PDV
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', minHeight: 0 }}>
                {navItems.map((item) => {
                    const color = iconColors[item.key] || '#6366f1';
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={handleNavClick}
                            style={({ isActive }) => ({
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '9px 10px',
                                borderRadius: '10px',
                                color: isActive ? color : 'var(--color-text-secondary)',
                                background: isActive ? color + '15' : 'transparent',
                                textDecoration: 'none',
                                fontWeight: isActive ? 700 : 500,
                                fontSize: '14px',
                                transition: 'all 0.15s',
                                position: 'relative'
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
                            {({ isActive }) => (
                                <>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        background: isActive ? color + '22' : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        color: isActive ? color : 'var(--color-text-muted)',
                                        transition: 'all 0.15s'
                                    }}>
                                        <item.icon size={17} />
                                    </div>
                                    <span>{item.label}</span>
                                    {isActive && (
                                        <div style={{ position: 'absolute', right: '10px', width: '6px', height: '6px', borderRadius: '50%', background: color }} />
                                    )}
                                </>
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Footer */}
            <div style={{ padding: '10px', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                {settingsItem && (
                    <NavLink
                        to={settingsItem.path}
                        onClick={handleNavClick}
                        style={({ isActive }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '9px 10px',
                            borderRadius: '10px',
                            color: isActive ? iconColors.settings : 'var(--color-text-secondary)',
                            background: isActive ? iconColors.settings + '15' : 'transparent',
                            textDecoration: 'none',
                            fontWeight: isActive ? 700 : 500,
                            fontSize: '14px',
                            transition: 'all 0.15s'
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
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--color-text-muted)' }}>
                            <Settings size={17} />
                        </div>
                        <span>Configurações</span>
                    </NavLink>
                )}

                <button
                    onClick={toggleTheme}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', background: 'var(--color-bg-hover)', border: 'none', borderRadius: '10px', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '14px', fontWeight: 500, width: '100%', transition: 'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-primary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                >
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {theme === 'light' || settings?.theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
                    </div>
                    <span>{theme === 'light' || settings?.theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}</span>
                </button>

                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center', paddingTop: '4px' }}>
                    © 2024 MR Bebidas
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
