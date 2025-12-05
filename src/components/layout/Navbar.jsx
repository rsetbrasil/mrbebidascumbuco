import React from 'react';
import { DollarSign, User, Menu, LogOut } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';

const Navbar = ({ onMenuClick }) => {
    const { currentCashRegister } = useApp();
    const { user, logout } = useAuth();

    return (
        <nav style={{
            background: 'var(--color-bg-secondary)',
            borderBottom: '1px solid var(--color-border)',
            padding: 'var(--spacing-md) var(--spacing-lg)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            backdropFilter: 'blur(10px)'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                maxWidth: '1400px',
                margin: '0 auto'
            }}>
                {/* Left side */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                    {/* Mobile Menu Button */}
                    {onMenuClick && (
                        <button
                            onClick={onMenuClick}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--color-text-primary)',
                                cursor: 'pointer',
                                padding: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: 'var(--radius-md)',
                                transition: 'background var(--transition-fast)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <Menu size={24} />
                        </button>
                    )}

                    <h1 style={{
                        fontSize: onMenuClick ? 'var(--font-size-lg)' : 'var(--font-size-xl)',
                        fontWeight: 800,
                        background: 'var(--gradient-primary)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        margin: 0
                    }}>
                        {onMenuClick ? 'MR BEBIDAS' : 'PDV MR BEBIDAS'}
                    </h1>
                </div>

                {/* Right side */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                    {/* Cash Register Status */}
                    {currentCashRegister ? (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                            padding: '8px 12px',
                            background: 'var(--color-success)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: onMenuClick ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                            color: 'white',
                            fontWeight: 600
                        }}>
                            <DollarSign size={onMenuClick ? 14 : 16} />
                            <span style={{ display: onMenuClick ? 'none' : 'inline' }}>Caixa Aberto</span>
                            <span style={{ display: onMenuClick ? 'inline' : 'none' }}>Aberto</span>
                        </div>
                    ) : (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                            padding: '8px 12px',
                            background: 'var(--color-danger)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: onMenuClick ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                            color: 'white',
                            fontWeight: 600
                        }}>
                            <DollarSign size={onMenuClick ? 14 : 16} />
                            <span>Fechado</span>
                        </div>
                    )}

                    {/* User Info */}
                    <div style={{
                        display: onMenuClick ? 'none' : 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        color: 'var(--color-text-secondary)',
                        padding: '4px 8px',
                        background: 'var(--color-bg-primary)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)'
                    }}>
                        <User size={16} />
                        <span style={{ fontWeight: 500 }}>{user?.name || 'Operador'}</span>
                        <span style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-muted)',
                            textTransform: 'uppercase'
                        }}>
                            ({user?.role === 'manager' ? 'GERENTE' : 'VENDEDOR'})
                        </span>
                    </div>

                    <button
                        onClick={logout}
                        title="Sair"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            padding: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: 'var(--radius-md)',
                            transition: 'all var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--color-bg-hover)';
                            e.currentTarget.style.color = 'var(--color-danger)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                        }}
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
