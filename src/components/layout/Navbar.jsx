import React, { useEffect, useState, useRef } from 'react';
import { DollarSign, User, Menu, LogOut, Search } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import Input from '../common/Input';
import Button from '../common/Button';
import { productService } from '../../services/firestore';
import { formatCurrency } from '../../utils/formatters';

const Navbar = ({ onMenuClick }) => {
    const { currentCashRegister, settings, isSyncing } = useApp();
    const { user, logout } = useAuth();

    const [time, setTime] = useState('');
    const [isCompact, setIsCompact] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [priceModalOpen, setPriceModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const searchInputRef = useRef(null);
    const panelRef = useRef(null);

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
            const w = window.innerWidth;
            setIsCompact(w < 1024);
            setIsMobile(w < 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        const handleShortcut = (e) => {
            if (e.key === 'F7') {
                e.preventDefault();
                setPriceModalOpen(true);
            }
        };
        window.addEventListener('keydown', handleShortcut);
        return () => window.removeEventListener('keydown', handleShortcut);
    }, []);

    useEffect(() => {
        if (priceModalOpen) {
            setLoadingProducts(true);
            setSearchTerm('');
            setFilteredProducts([]);
            productService.getAll()
                .then((list) => {
                    setProducts(list);
                    setFilteredProducts(list.slice(0, 50));
                    setTimeout(() => {
                        searchInputRef.current?.focus();
                    }, 100);
                })
                .finally(() => setLoadingProducts(false));
        }
    }, [priceModalOpen]);

    useEffect(() => {
        if (!priceModalOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') setPriceModalOpen(false);
        };
        const handleClickOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setPriceModalOpen(false);
            }
        };
        document.addEventListener('keydown', handleKey);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('keydown', handleKey);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [priceModalOpen]);

    useEffect(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) {
            setFilteredProducts(products.slice(0, 50));
            return;
        }
        const results = products.filter(p =>
            (p.name || '').toLowerCase().includes(term) ||
            (String(p.barcode || '').includes(term))
        );
        setFilteredProducts(results.slice(0, 100));
    }, [searchTerm, products]);

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
                gridTemplateColumns: isMobile ? 'auto 1fr auto' : '1fr auto 1fr',
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
                        fontSize: isMobile ? 'var(--font-size-lg)' : (onMenuClick ? 'var(--font-size-lg)' : 'var(--font-size-xl)'),
                        fontWeight: 800,
                        background: 'var(--gradient-primary)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        margin: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {(settings?.headerTitle || 'Deus é Fiel!')}
                    </h1>

                    <button
                        onClick={() => setPriceModalOpen(true)}
                        title="Consultar Preços (F7)"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: (onMenuClick || isCompact) ? '6px 10px' : '8px 12px',
                            background: 'var(--color-primary)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 'var(--radius-full)',
                            fontSize: (onMenuClick || isCompact) ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'all var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.05)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                    >
                        <Search size={(onMenuClick || isCompact) ? 14 : 16} />
                        <span style={{ display: isMobile ? 'none' : 'inline' }}>Consultar Preços (F7)</span>
                        <span style={{ display: isMobile ? 'inline' : 'none' }}>Preços (F7)</span>
                    </button>
                </div>

                {/* Middle: Digital Clock */}
                {!isMobile && (
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
                )}

                {/* Right side */}
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-md)', justifyContent: 'flex-end' }}>
                    {isOnline && isSyncing && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                            padding: (onMenuClick || isCompact) ? '6px 10px' : '8px 12px',
                            background: 'var(--color-accent)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: (onMenuClick || isCompact) ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                            color: 'white',
                            fontWeight: 700,
                            whiteSpace: 'nowrap'
                        }}>
                            <span>Sincronizando...</span>
                        </div>
                    )}
                    {/* Network Status */}
                    {!isOnline && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                            padding: (onMenuClick || isCompact) ? '6px 10px' : '8px 12px',
                            background: 'var(--color-warning)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: (onMenuClick || isCompact) ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                            color: 'white',
                            fontWeight: 700,
                            whiteSpace: 'nowrap'
                        }}>
                            <span>Offline</span>
                        </div>
                    )}
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
                        display: (onMenuClick || isMobile) ? 'none' : 'flex',
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

                    {!isMobile && (
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
                    )}
                </div>
            </div>

            {priceModalOpen && (
                <div
                    ref={panelRef}
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 'var(--spacing-lg)',
                        width: isMobile ? 'calc(100% - 2 * var(--spacing-lg))' : '520px',
                        left: isMobile ? 'var(--spacing-lg)' : 'auto',
                        background: 'var(--color-bg-primary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 1000,
                        overflow: 'hidden'
                    }}
                >
                    <div style={{ position: 'sticky', top: 0, background: 'var(--color-bg-primary)', borderBottom: '1px solid var(--color-border)', padding: 'var(--spacing-md)' }}>
                        <Input
                            ref={searchInputRef}
                            placeholder="Buscar por nome ou código de barras..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon={<Search size={20} />}
                            autoFocus
                        />
                    </div>
                    <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        {loadingProducts ? (
                            <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                                Carregando...
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                                Nenhum produto encontrado
                            </div>
                        ) : (
                            filteredProducts.map((product) => (
                                <div
                                    key={product.id}
                                    style={{
                                        padding: 'var(--spacing-md)',
                                        borderBottom: '1px solid var(--color-divider)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{product.name}</div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                            {product.barcode || 'Sem código'} | Atacado: {product.stock ?? 0} | Mercearia: {product.coldStock ?? 0}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                                            Atacado: {formatCurrency(product.wholesalePrice || product.price)}
                                        </div>
                                        <div style={{ fontWeight: 600, color: '#3b82f6' }}>
                                            Mercearia: {formatCurrency(product.coldPrice || product.price)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--spacing-md)', borderTop: '1px solid var(--color-border)' }}>
                        <Button variant="ghost" onClick={() => setPriceModalOpen(false)}>Fechar</Button>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
