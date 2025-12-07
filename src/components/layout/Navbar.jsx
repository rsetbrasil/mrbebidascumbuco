import React, { useEffect, useState } from 'react';
import { DollarSign, User, Menu, LogOut } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';

const Navbar = ({ onMenuClick }) => {
    const { currentCashRegister, settings } = useApp();
    const { user, logout } = useAuth();

    const [time, setTime] = useState('');
    const [isCompact, setIsCompact] = useState(false);
    useEffect(() => {
        const tick = () => {
            const now = new Date();
            setTime(now.toLocaleTimeString('pt-BR', { hour12: false }));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const handleResize = () => {
            setIsCompact(window.innerWidth < 1024);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
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
                        {settings?.headerTitle || 'Deus é Fiel!'}
                    </h1>
                </div>

                {/* Middle: Digital Clock */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <div style={{
                        fontFamily: 'Courier New, monospace',
                        fontSize: onMenuClick ? 'var(--font-size-md)' : '1.25rem',
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        background: 'var(--color-bg-primary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '6px 12px',
                        minWidth: '120px',
                        textAlign: 'center'
                    }}>{time}</div>
                </div>

                {/* Right side */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
                    {/* Cash Register Status */}
                    {currentCashRegister ? (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                            padding: (onMenuClick || isCompact) ? '6px 10px' : '8px 12px',
                            background: 'var(--color-success)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: (onMenuClick || isCompact) ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                            color: 'white',
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                        }}>
                            <DollarSign size={(onMenuClick || isCompact) ? 14 : 16} />
                            <span style={{ display: (onMenuClick || isCompact) ? 'none' : 'inline' }}>Caixa Aberto</span>
                            <span style={{ display: (onMenuClick || isCompact) ? 'inline' : 'none' }}>Aberto</span>
                        </div>
                    ) : (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                            padding: (onMenuClick || isCompact) ? '6px 10px' : '8px 12px',
                            background: 'var(--color-danger)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: (onMenuClick || isCompact) ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                            color: 'white',
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                        }}>
                            <DollarSign size={(onMenuClick || isCompact) ? 14 : 16} />
                            <span style={{ display: (onMenuClick || isCompact) ? 'inline' : 'inline' }}>{(onMenuClick || isCompact) ? 'Fech.' : 'Fechado'}</span>
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
                            ({user?.role === 'manager' ? 'GERENTE' : (user?.role === 'cashier' ? 'CAIXA' : 'VENDEDOR')})
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
