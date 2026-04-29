import React, { useEffect, useState, useRef } from 'react';
import { DollarSign, User, Menu, LogOut, Search } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Input from '../common/Input';
import Button from '../common/Button';
import { productService } from '../../services/firestore';
import { formatCurrency } from '../../utils/formatters';

const Navbar = ({ onMenuClick }) => {
    const { currentCashRegister, settings, isSyncing } = useApp();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

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
        const handleResize = () => setIsMobile(window.innerWidth < 768);
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
            if (e.key === 'F7') { e.preventDefault(); setPriceModalOpen(true); }
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
                    setTimeout(() => { searchInputRef.current?.focus(); }, 100);
                })
                .finally(() => setLoadingProducts(false));
        }
    }, [priceModalOpen]);

    useEffect(() => {
        if (!priceModalOpen) return;
        const handleKey = (e) => { if (e.key === 'Escape') setPriceModalOpen(false); };
        const handleClickOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setPriceModalOpen(false);
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
        if (!term) { setFilteredProducts(products.slice(0, 50)); return; }
        const results = products.filter(p =>
            (p.name || '').toLowerCase().includes(term) ||
            String(p.barcode || '').includes(term)
        );
        setFilteredProducts(results.slice(0, 100));
    }, [searchTerm, products]);

    const roleLabel = user?.role === 'manager' ? 'GERENTE' : user?.role === 'cashier' ? 'CAIXA' : user?.role === 'viewer' ? 'VISUALIZADOR' : 'VENDEDOR';

    return (
        <nav style={{
            background: 'var(--color-bg-secondary)',
            borderBottom: '1px solid var(--color-border)',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            backdropFilter: 'blur(10px)'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                maxWidth: '1400px',
                margin: '0 auto',
                padding: isMobile ? '0 16px' : '0 var(--spacing-xl)',
                gap: '12px'
            }}>
                {/* Left */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {onMenuClick && (
                        <button onClick={onMenuClick} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', cursor: 'pointer', width: '34px', height: '34px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }} title="Menu">
                            <Menu size={18} />
                        </button>
                    )}
                    <button
                        onClick={() => setPriceModalOpen(true)}
                        title="Consultar Preços (F7)"
                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: 'var(--gradient-primary)', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.25)', whiteSpace: 'nowrap' }}
                    >
                        <Search size={14} />
                        {isMobile ? 'Preços' : 'Consultar Preços (F7)'}
                    </button>
                </div>

                {/* Right */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Status badges */}
                    {isOnline && isSyncing && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 10px', background: 'var(--color-accent)', borderRadius: '20px', fontSize: '12px', color: 'white', fontWeight: 700 }}>
                            Sincronizando...
                        </div>
                    )}
                    {!isOnline && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 10px', background: 'var(--color-warning)', borderRadius: '20px', fontSize: '12px', color: 'white', fontWeight: 700 }}>
                            Offline
                        </div>
                    )}

                    {/* Cash register */}
                    <button
                        onClick={() => navigate('/caixa')}
                        title={currentCashRegister ? 'Caixa Aberto' : 'Caixa Fechado'}
                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', height: '34px', borderRadius: '8px', border: 'none', background: currentCashRegister ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)', color: currentCashRegister ? '#10b981' : 'var(--color-danger)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                        <DollarSign size={14} />
                        {isMobile ? 'Caixa' : currentCashRegister ? 'Caixa Aberto' : 'Caixa Fechado'}
                    </button>

                    {/* User info */}
                    {!isMobile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--color-bg-primary)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <User size={14} color="#fff" />
                            </div>
                            <div style={{ lineHeight: 1.2 }}>
                                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>{user?.name || 'Operador'}</div>
                                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{roleLabel}</div>
                            </div>
                        </div>
                    )}

                    {/* Logout */}
                    <button
                        onClick={logout}
                        title="Sair"
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '7px', display: 'flex', alignItems: 'center', borderRadius: '8px', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = 'var(--color-danger)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>

            {/* Price Modal */}
            {priceModalOpen && (
                <div ref={panelRef} style={{ position: 'absolute', top: 'calc(100% + 8px)', left: isMobile ? '16px' : 'auto', right: isMobile ? '16px' : 'var(--spacing-lg)', width: isMobile ? 'auto' : '520px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '14px', boxShadow: 'var(--shadow-lg)', zIndex: 1000, overflow: 'hidden' }}>
                    <div style={{ position: 'sticky', top: 0, background: 'var(--color-bg-primary)', borderBottom: '1px solid var(--color-border)', padding: '14px' }}>
                        <Input ref={searchInputRef} placeholder="Buscar por nome ou código de barras..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={<Search size={18} />} autoFocus />
                    </div>
                    <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        {loadingProducts ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>
                        ) : filteredProducts.length === 0 ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhum produto encontrado</div>
                        ) : (
                            filteredProducts.map((product) => (
                                <div key={product.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{product.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                            {product.barcode || 'Sem código'} · Atac: {product.stock ?? 0} · Merc: {product.coldStock ?? 0}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#22c55e' }}>
                                            {product.wholesalePrice === null ? '—' : formatCurrency((product.wholesalePrice ?? product.price) || 0)}
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#3b82f6' }}>
                                            {product.coldPrice === null ? '—' : formatCurrency((product.coldPrice ?? product.price) || 0)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
                        <button onClick={() => setPriceModalOpen(false)} style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Fechar</button>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
