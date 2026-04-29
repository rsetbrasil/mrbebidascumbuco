import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList,
    Search,
    ShoppingCart,
    XCircle,
    CheckCircle,
    Clock,
    Printer,
    Edit,
    RefreshCw,
    Eye
} from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Loading from '../../common/Loading';
import Notification from '../../common/Notification';
import Modal from '../../common/Modal';
import { presalesService, productService } from '../../../services/firestore';
import { useCart } from '../../../contexts/CartContext';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { printReceipt } from '../../../utils/receiptPrinter';
import { useApp } from '../../../contexts/AppContext';
import { useAuth } from '../../../contexts/AuthContext';

const PresalesPage = () => {
    const navigate = useNavigate();
    const { loadPresale } = useCart();
    const { settings } = useApp();
    const { canWrite } = useAuth();
    const searchInputRef = useRef(null);

    const [presales, setPresales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending'); // pending, completed, cancelled, all
    const [notification, setNotification] = useState(null);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewPresale, setViewPresale] = useState(null);

    useEffect(() => {
        setLoading(true);
        const unsub = presalesService.subscribeAll((data) => {
            setPresales(data);
            setLoading(false);
        });
        return () => { try { unsub && unsub(); } catch {} };
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // F2 - Novo Pedido
            if (e.key === 'F2') {
                e.preventDefault();
                navigate('/vendas');
            }
            // F3 - Focar busca
            else if (e.key === 'F3') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate]);

    // Removed setBusy usage; AppContext does not expose this API

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await presalesService.getAll();
            setPresales(data);
        } catch (error) {
            console.error('Error loading presales:', error);
            showNotification('error', 'Erro ao carregar pedidos');
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleConvertToSale = (presale) => {
        try {
            loadPresale(presale);
            navigate('/vendas');
        } catch (error) {
            console.error('Error loading presale:', error);
            showNotification('error', 'Erro ao carregar pedido');
        }
    };

    const handleCancel = async (presale) => {
        if (!window.confirm('Tem certeza que deseja cancelar este pedido?')) return;

        try {
            // 1. Marca a pré-venda como cancelada e libera a flag de reserva
            await presalesService.update(presale.id, {
                status: 'cancelled',
                reserved: false,
                cancelledAt: new Date()
            });

            // 2. Recalcula TODAS as reservas do zero com base nas pré-vendas ainda pendentes
            //    Isso garante que o estoque reservado seja sempre consistente,
            //    independente de multiplicadores de unidade ou dados inconsistentes.
            await presalesService.recomputeReservations();

            showNotification('success', 'Pedido cancelado com sucesso');
            loadData();
        } catch (error) {
            console.error('Error cancelling presale:', error);
            showNotification('error', 'Erro ao cancelar pedido');
        }
    };

    const handlePrintPresale = (presale) => {
        try {
            const presaleForPrint = {
                ...presale,
                saleNumber: presale.id.substring(0, 8).toUpperCase(),
                paymentMethod: 'Pré-venda',
                paymentStatus: 'pending'
            };
            printReceipt(presaleForPrint, settings);
            showNotification('success', 'Comprovante enviado para impressão');
        } catch (error) {
            console.error('Error printing presale:', error);
            showNotification('error', 'Erro ao imprimir comprovante');
        }
    };

    const handleEditPresale = (presale) => {
        try {
            loadPresale(presale);
            navigate('/vendas');
            showNotification('success', 'Pré-venda carregada para edição');
        } catch (error) {
            console.error('Error loading presale for edit:', error);
            showNotification('error', 'Erro ao carregar pré-venda');
        }
    };

    const handleViewPresale = (presale) => {
        setViewPresale(presale);
        setViewModalOpen(true);
    };

    const filteredPresales = (presales || []).filter(p => {
        const matchesSearch =
            (p.customerName && p.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            p.id.toLowerCase().includes(searchTerm.toLowerCase());

        const pStatus = p.status || 'pending';
        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'reserved'
                ? (pStatus === 'pending' && p.reserved === true)
                : pStatus === statusFilter);

        return matchesSearch && matchesStatus;
    }).sort((a, b) => {
        const av = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const bv = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return bv - av;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return { color: 'var(--color-success)', background: 'rgba(16, 185, 129, 0.1)' };
            case 'cancelled': return { color: 'var(--color-danger)', background: 'rgba(239, 68, 68, 0.1)' };
            default: return { color: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.1)' };
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'completed': return 'Concluído';
            case 'cancelled': return 'Cancelado';
            default: return 'Pendente';
        }
    };

    if (loading && !presales.length) return <Loading fullScreen />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {notification && (
                <Notification
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                        {filteredPresales.filter(p => p.status === 'pending').length} pedido(s) pendente(s)
                    </div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>Pedidos / Pré-Vendas</h1>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                    {canWrite && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                            padding: '0 var(--spacing-md)',
                            color: 'var(--color-text-secondary)',
                            fontSize: 'var(--font-size-sm)'
                        }}>
                            <span><kbd style={{ background: 'var(--color-bg-secondary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>F2</kbd> Novo</span>
                            <span><kbd style={{ background: 'var(--color-bg-secondary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>F3</kbd> Buscar</span>
                        </div>
                    )}
                    {canWrite && (
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                            <Button
                                onClick={async () => {
                                    if(!window.confirm('Verificar e corrigir todos os estoques reservados? O sistema irá recalcular as quantidades baseando-se apenas nos pedidos pendentes.')) return;
                                    try {
                                        const res = await presalesService.recomputeReservations();
                                        showNotification('success', `Estoque sincronizado! ${res.updated} produtos corrigidos em ${res.pendingPresales} pré-vendas ativas.`);
                                        loadData();
                                    } catch(e) {
                                        console.error(e);
                                        showNotification('error', 'Erro ao recalcular estoques. Tente novamente.');
                                    }
                                }}
                                variant="secondary"
                                icon={<RefreshCw size={20} />}
                            >
                                Sincronizar Reservas
                            </Button>
                            <Button
                                onClick={() => navigate('/vendas')}
                                icon={<ShoppingCart size={20} />}
                            >
                                Novo Pedido (PDV)
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ maxWidth: '340px', flex: 1 }}>
                        <Input ref={searchInputRef} placeholder="Buscar por cliente ou número..." icon={Search} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {['pending', 'reserved', 'completed', 'cancelled', 'all'].map(status => (
                            <button key={status} onClick={() => setStatusFilter(status)} style={{ padding: '7px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, border: '1px solid', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', borderColor: statusFilter === status ? 'var(--color-primary)' : 'var(--color-border)', background: statusFilter === status ? 'var(--color-primary)' : 'transparent', color: statusFilter === status ? '#fff' : 'var(--color-text-secondary)' }}>
                                {status === 'all' ? 'Todos' : status === 'reserved' ? 'Reservados' : getStatusLabel(status)}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                {['Data/Hora', 'Cliente', 'Itens', 'Total', 'Tipo', 'Vendedor', 'Status', 'Ações'].map((h, i) => (
                                    <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i === 7 ? 'right' : 'left' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPresales.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        <ClipboardList size={40} style={{ opacity: 0.15, display: 'block', margin: '0 auto 10px' }} />
                                        <p style={{ margin: 0 }}>Nenhum pedido encontrado</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredPresales.map((presale) => {
                                    const presaleStatus = presale.status || 'pending';
                                    return (
                                    <tr key={presale.id} style={{ borderBottom: '1px solid var(--color-divider)', transition: 'background 0.1s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{formatDateTime(presale.createdAt)}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{presale.customerName || 'Cliente Balcão'}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{presale.items?.length || 0} itens</td>
                                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#22c55e', fontSize: '14px' }}>{formatCurrency(presale.total)}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            {(() => {
                                                const items = presale.items || [];
                                                const hasCold = items.some(i => !!i.isCold);
                                                const hasWholesale = items.some(i => !i.isCold);
                                                return (
                                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                        {hasCold && <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', background: '#3b82f618', color: '#3b82f6' }}>Mercearia</span>}
                                                        {hasWholesale && <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', background: '#22c55e18', color: '#22c55e' }}>Atacado</span>}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' }}>
                                                {presale.createdBy || 'Vendedor'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '4px', ...getStatusColor(presaleStatus) }}>
                                                {presaleStatus === 'completed' && <CheckCircle size={11} />}
                                                {presaleStatus === 'cancelled' && <XCircle size={11} />}
                                                {presaleStatus === 'pending' && <Clock size={11} />}
                                                {getStatusLabel(presaleStatus)}
                                            </span>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)', textAlign: 'right' }}>
                                            {presaleStatus === 'pending' && (
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
                                                    {canWrite && (
                                                        <button
                                                            onClick={() => handleEditPresale(presale)}
                                                            style={{
                                                                padding: '8px',
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: 'var(--color-primary)',
                                                                cursor: 'pointer',
                                                                borderRadius: 'var(--radius-md)',
                                                                transition: 'background var(--transition-fast)'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                            title="Editar"
                                                        >
                                                            <Edit size={18} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleViewPresale(presale)}
                                                        style={{
                                                            padding: '8px',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: 'var(--color-text-secondary)',
                                                            cursor: 'pointer',
                                                            borderRadius: 'var(--radius-md)',
                                                            transition: 'background var(--transition-fast)'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        title="Ver"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    {canWrite && (
                                                        <Button
                                                            size="sm"
                                                            variant="primary"
                                                            onClick={() => handleConvertToSale(presale)}
                                                            icon={<ShoppingCart size={16} />}
                                                        >
                                                            Finalizar
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => handlePrintPresale(presale)}
                                                        icon={<Printer size={16} />}
                                                    >
                                                        Imprimir
                                                    </Button>
                                                    {canWrite && (
                                                        <button
                                                            onClick={() => handleCancel(presale)}
                                                            style={{
                                                                padding: '8px',
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: 'var(--color-danger)',
                                                                cursor: 'pointer',
                                                                borderRadius: 'var(--radius-md)',
                                                                transition: 'background var(--transition-fast)'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                            title="Cancelar"
                                                        >
                                                            <XCircle size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* View Presale Modal */}
            <Modal
                isOpen={viewModalOpen}
                onClose={() => setViewModalOpen(false)}
                title={`Pré-venda ${viewPresale ? '#' + viewPresale.id.substring(0,8).toUpperCase() : ''}`}
                size="md"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {viewPresale && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)' }}>
                                <div>
                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Cliente</div>
                                    <div style={{ fontWeight: 600 }}>{viewPresale.customerName || 'Cliente Balcão'}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Data</div>
                                    <div style={{ fontWeight: 600 }}>{formatDateTime(viewPresale.createdAt)}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Vendedor</div>
                                    <div style={{ fontWeight: 600 }}>{viewPresale.createdBy || 'Vendedor'}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {(() => {
                                    const items = viewPresale.items || [];
                                    const hasCold = items.some(i => !!i.isCold);
                                    const hasWholesale = items.some(i => !i.isCold);
                                    return (
                                        <>
                                            {hasCold && (
                                                <span style={{
                                                    padding: '4px 8px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    background: 'var(--color-primary)',
                                                    color: '#fff',
                                                    fontSize: 'var(--font-size-xs)',
                                                    fontWeight: 500,
                                                    border: '1px solid var(--color-primary)'
                                                }}>Mercearia</span>
                                            )}
                                            {hasWholesale && (
                                                <span style={{
                                                    padding: '4px 8px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    background: 'var(--color-success)',
                                                    color: '#fff',
                                                    fontSize: 'var(--font-size-xs)',
                                                    fontWeight: 500,
                                                    border: '1px solid var(--color-success)'
                                                }}>Atacado</span>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                {(viewPresale.items || []).map((item, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--color-divider)' }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{item.productName}</div>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                                {item.quantity} {(item.unit?.abbreviation || item.unit?.name || 'un')} x {formatCurrency(item.unitPrice)}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{formatCurrency(item.unitPrice)}</div>
                                        <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(item.total)}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)' }}>
                                <div>
                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Subtotal</div>
                                    <div style={{ fontWeight: 600 }}>{formatCurrency(viewPresale.subtotal || viewPresale.total)}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Total</div>
                                    <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{formatCurrency(viewPresale.total)}</div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default PresalesPage;
