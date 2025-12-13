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
    Database
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

const Sidebar = ({ onClose }) => {
    const { isManager } = useAuth();
    const { settings } = useApp();

    const baseMenu = {
        pdv: { path: '/sales', icon: ShoppingCart, label: 'PDV' },
        products: { path: '/products', icon: Package, label: 'Produtos' },
        categories: { path: '/categories', icon: Database, label: 'Categorias' },
        customers: { path: '/customers', icon: Users, label: 'Clientes' },
        sales: { path: '/sales-history', icon: ClipboardList, label: 'Vendas' },
        presales: { path: '/presales', icon: ClipboardList, label: 'Pré-vendas' },
        financial: { path: '/financial', icon: BarChart3, label: 'Financeiro', restricted: true },
        cashRegister: { path: '/cash-register', icon: Wallet, label: 'Caixa', restricted: true },
        cashRegisterHistory: { path: '/historico-caixa', icon: Wallet, label: 'Histórico de Caixa', restricted: true },
        settings: { path: '/settings', icon: Settings, label: 'Configurações', restricted: true },
        resetData: { path: '/reset-data', icon: Database, label: 'Resetar Dados', restricted: true },
        dashboard: { path: '/', icon: Home, label: 'Painel', restricted: true }
    };

    const pref = Array.isArray(settings?.menu) ? settings.menu : null;
    let menuItems = Object.entries(baseMenu).map(([key, def]) => ({ key, visible: true, ...def }));
    if (pref) {
        const visibility = new Map(pref.map(item => [item.key, item.visible !== false]));
        const order = pref.map(item => item.key);
        menuItems = menuItems
            .map(it => ({ ...it, visible: visibility.has(it.key) ? visibility.get(it.key) : true }))
            .sort((a, b) => {
                const ia = order.indexOf(a.key);
                const ib = order.indexOf(b.key);
                if (ia === -1 && ib === -1) return 0;
                if (ia === -1) return 1;
                if (ib === -1) return -1;
                return ia - ib;
            });
    } else {
        const defaultOrder = [
            'pdv',
            'products',
            'categories',
            'customers',
            'sales',
            'presales',
            'financial',
            'cashRegister',
            'cashRegisterHistory',
            'settings',
            'resetData',
            'dashboard'
        ];
        menuItems = menuItems.sort((a, b) => {
            const ia = defaultOrder.indexOf(a.key);
            const ib = defaultOrder.indexOf(b.key);
            if (ia === -1 && ib === -1) return 0;
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });
    }

    const filteredItems = menuItems.filter(item => item.visible && (!item.restricted || isManager));

    const handleNavClick = () => {
        if (onClose) onClose();
    };

    return (
        <aside style={{
            width: '280px',
            background: 'var(--color-bg-secondary)',
            borderRight: '1px solid var(--color-border)',
            height: '100vh',
            position: 'sticky',
            top: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Logo/Brand */}
            <div style={{
                padding: 'var(--spacing-xl)',
                borderBottom: '1px solid var(--color-border)'
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
                gap: 'var(--spacing-xs)'
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

            {/* Footer */}
            <div style={{
                padding: 'var(--spacing-md)',
                borderTop: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
                textAlign: 'center'
            }}>
                © 2024 MR Bebidas
            </div>
        </aside>
    );
};

export default Sidebar;
