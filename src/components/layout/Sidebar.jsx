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

const Sidebar = ({ onClose }) => {
    const { isManager } = useAuth();

    const menuItems = [
        { path: '/', icon: Home, label: 'Painel', restricted: true },
        { path: '/sales', icon: ShoppingCart, label: 'PDV' },
        { path: '/sales-history', icon: ClipboardList, label: 'Vendas' },
        { path: '/products', icon: Package, label: 'Produtos' },
        { path: '/categories', icon: Database, label: 'Categorias' },
        { path: '/customers', icon: Users, label: 'Clientes' },
        { path: '/cash-register', icon: Wallet, label: 'Caixa', restricted: true },
        { path: '/presales', icon: ClipboardList, label: 'Pré-vendas' },
        { path: '/financial', icon: BarChart3, label: 'Financeiro', restricted: true },
        { path: '/settings', icon: Settings, label: 'Configurações', restricted: true },
        { path: '/reset-data', icon: Database, label: 'Resetar Dados', restricted: true }
    ];

    const filteredItems = menuItems.filter(item => !item.restricted || isManager);

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
