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
    Edit
} from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Loading from '../../common/Loading';
import Notification from '../../common/Notification';
import { presalesService } from '../../../services/firestore';
import { useCart } from '../../../contexts/CartContext';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { printReceipt } from '../../../utils/receiptPrinter';

const PresalesPage = () => {
    const navigate = useNavigate();
    const { loadPresale } = useCart();
    const searchInputRef = useRef(null);

    const [presales, setPresales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending'); // pending, completed, cancelled, all
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // F2 - Novo Pedido
            if (e.key === 'F2') {
                e.preventDefault();
                navigate('/sales');
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
            navigate('/sales');
        } catch (error) {
            console.error('Error loading presale:', error);
            showNotification('error', 'Erro ao carregar pedido');
        }
    };

    const handleCancel = async (id) => {
        if (!window.confirm('Tem certeza que deseja cancelar este pedido?')) return;

        try {
            await presalesService.updateStatus(id, 'cancelled');
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
            printReceipt(presaleForPrint);
            showNotification('success', 'Comprovante enviado para impressão');
        } catch (error) {
            console.error('Error printing presale:', error);
            showNotification('error', 'Erro ao imprimir comprovante');
        }
    };

    const handleEditPresale = (presale) => {
        try {
            loadPresale(presale);
            navigate('/sales');
            showNotification('success', 'Pré-venda carregada para edição');
        } catch (error) {
            console.error('Error loading presale for edit:', error);
            showNotification('error', 'Erro ao carregar pré-venda');
        }
    };

    const filteredPresales = presales.filter(p => {
        const matchesSearch =
            (p.customerName && p.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            p.id.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

        return matchesSearch && matchesStatus;
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

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--spacing-md)'
            }}>
                <div>
                    <h1 style={{
                        fontSize: 'var(--font-size-2xl)',
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        marginBottom: 'var(--spacing-xs)'
                    }}>Pedidos / Pré-Vendas</h1>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Gerencie os pedidos em aberto</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
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
                    <Button
                        onClick={() => navigate('/sales')}
                        icon={<ShoppingCart size={20} />}
                    >
                        Novo Pedido (PDV)
                    </Button>
                </div>
            </div>

            <Card>
                <div style={{
                    padding: 'var(--spacing-md)',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 'var(--spacing-md)',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ width: '100%', maxWidth: '400px' }}>
                        <Input
                            ref={searchInputRef}
                            placeholder="Buscar por cliente ou número..."
                            icon={Search}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', overflowX: 'auto', paddingBottom: '4px' }}>
                        {['pending', 'completed', 'cancelled', 'all'].map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: 'var(--font-size-sm)',
                                    fontWeight: 500,
                                    border: 'none',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all var(--transition-fast)',
                                    background: statusFilter === status ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                                    color: statusFilter === status ? '#fff' : 'var(--color-text-secondary)'
                                }}
                            >
                                {status === 'all' ? 'Todos' : getStatusLabel(status)}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Data/Hora</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Cliente</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Itens</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Total</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Tipo</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Status</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600, textAlign: 'right' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPresales.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <ClipboardList size={48} style={{ opacity: 0.2 }} />
                                            <p>Nenhum pedido encontrado</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredPresales.map((presale) => (
                                    <tr key={presale.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                                        <td style={{ padding: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
                                            {formatDateTime(presale.createdAt)}
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)' }}>
                                            <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                                {presale.customerName || 'Cliente Balcão'}
                                            </div>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
                                            {presale.items?.length || 0} itens
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)', fontWeight: 500, color: 'var(--color-success)' }}>
                                            {formatCurrency(presale.total)}
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                background: presale.priceType === 'wholesale' ? 'var(--color-info-bg)' : 'var(--color-bg-secondary)',
                                                color: presale.priceType === 'wholesale' ? 'var(--color-info)' : 'var(--color-text-secondary)',
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: 500,
                                                border: presale.priceType === 'wholesale' ? '1px solid var(--color-info-border)' : '1px solid var(--color-border)'
                                            }}>
                                                {presale.priceType === 'wholesale' ? 'Atacado' : 'Varejo'}
                                            </span>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: 500,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                ...getStatusColor(presale.status)
                                            }}>
                                                {presale.status === 'completed' && <CheckCircle size={12} />}
                                                {presale.status === 'cancelled' && <XCircle size={12} />}
                                                {presale.status === 'pending' && <Clock size={12} />}
                                                {getStatusLabel(presale.status)}
                                            </span>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)', textAlign: 'right' }}>
                                            {presale.status === 'pending' && (
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
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
                                                    <Button
                                                        size="sm"
                                                        variant="primary"
                                                        onClick={() => handleConvertToSale(presale)}
                                                        icon={<ShoppingCart size={16} />}
                                                    >
                                                        Finalizar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => handlePrintPresale(presale)}
                                                        icon={<Printer size={16} />}
                                                    >
                                                        Imprimir
                                                    </Button>
                                                    <button
                                                        onClick={() => handleCancel(presale.id)}
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
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default PresalesPage;
