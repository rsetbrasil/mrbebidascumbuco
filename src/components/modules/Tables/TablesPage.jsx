import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Coffee,
    Search,
    Plus,
    ShoppingCart,
    XCircle,
    CheckCircle,
    Clock,
    Eye,
    Trash2,
    Users
} from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Loading from '../../common/Loading';
import Notification from '../../common/Notification';
import Modal from '../../common/Modal';
import { tablesService } from '../../../services/firestore';
import { useCart } from '../../../contexts/CartContext';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { useApp } from '../../../contexts/AppContext';
import { useAuth } from '../../../contexts/AuthContext';

const TablesPage = () => {
    const navigate = useNavigate();
    const { loadTable } = useCart();
    const { showNotification: appNotify } = useApp();
    const { canWrite, user } = useAuth();
    const searchInputRef = useRef(null);

    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('open');
    const [notification, setNotification] = useState(null);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewTable, setViewTable] = useState(null);

    // New Table Modal
    const [newTableModalOpen, setNewTableModalOpen] = useState(false);
    const [newTableName, setNewTableName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        setLoading(true);
        let unsub;

        const load = () => {
            if (statusFilter === 'all') {
                unsub = tablesService.subscribeAll((data) => {
                    setTables(data);
                    setLoading(false);
                });
            } else {
                unsub = tablesService.subscribeByStatus(statusFilter, (data) => {
                    setTables(data);
                    setLoading(false);
                });
            }
        };

        load();
        return () => { try { unsub && unsub(); } catch { } };
    }, [statusFilter]);

    // ... existing code ...

    const filteredTables = (tables || []).filter(t => {
        const matchesSearch =
            (t.customerName && t.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            t.id.toLowerCase().includes(searchTerm.toLowerCase());

        // Status filtering is now handled by Firestore subscription, 
        // but we keep this check for 'all' mode where we might want to filter search results 
        // or if we switch tabs rapidly and use cached data (though here we reset tables on filter change)
        // Actually, since 'tables' now contains only the filtered status (unless 'all'), 
        // we don't strictly need to filter by status again unless statusFilter is 'all'.
        // But keeping it robust:
        const tStatus = t.status || 'open';
        const matchesStatus = statusFilter === 'all' || tStatus === statusFilter;

        return matchesSearch && matchesStatus;
    }).sort((a, b) => {
        const av = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const bv = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return bv - av;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'closed': return { color: 'var(--color-success)', background: 'rgba(16, 185, 129, 0.1)' };
            case 'cancelled': return { color: 'var(--color-danger)', background: 'rgba(239, 68, 68, 0.1)' };
            default: return { color: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.1)' };
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'closed': return 'Fechada';
            case 'cancelled': return 'Cancelada';
            default: return 'Aberta';
        }
    };

    const getElapsedTime = (createdAt) => {
        if (!createdAt) return '';
        const ms = createdAt.toMillis ? createdAt.toMillis() : new Date(createdAt).getTime();
        const diff = Date.now() - ms;
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}min`;
        const hours = Math.floor(mins / 60);
        const remainMins = mins % 60;
        return `${hours}h${remainMins > 0 ? ` ${remainMins}min` : ''}`;
    };

    const handleViewTable = (table) => {
        setViewTable(table);
        setViewModalOpen(true);
    };

    const handleAddItems = (table) => {
        try {
            loadTable(table);
            navigate('/vendas');
        } catch (e) {
            setNotification({ type: 'error', message: 'Erro ao carregar itens da mesa' });
        }
    };

    const handleCloseTable = async (table) => {
        if (!table?.id) return;
        if (!window.confirm('Fechar esta mesa?')) return;
        try {
            await tablesService.close(table.id, null);
            appNotify('Mesa fechada com sucesso', 'success');
        } catch (e) {
            console.error(e);
            setNotification({ type: 'error', message: 'Erro ao fechar mesa' });
        }
    };

    const handleCancelTable = async (table) => {
        if (!table?.id) return;
        if (!window.confirm('Cancelar/Excluir esta mesa?')) return;
        try {
            await tablesService.delete(table.id);
            appNotify('Mesa excluída', 'success');
        } catch (e) {
            console.error(e);
            setNotification({ type: 'error', message: 'Erro ao excluir mesa' });
        }
    };

    const handleCreateTable = async () => {
        if (creating) return;
        const name = (newTableName || '').trim();
        if (!name) {
            setNotification({ type: 'warning', message: 'Informe o nome do cliente' });
            return;
        }
        try {
            setCreating(true);
            const created = await tablesService.create({
                customerName: name,
                items: [],
                subtotal: 0,
                productsTotal: 0,
                deliveryFeeMode: 'none',
                deliveryFeeRateId: null,
                deliveryFeeDescription: '',
                deliveryFeeValue: 0,
                total: 0,
                notes: ''
            });
            setNewTableModalOpen(false);
            setNewTableName('');
            appNotify('Mesa aberta com sucesso', 'success');
            const tableObj = created?.id ? { ...created, id: created.id } : created;
            if (tableObj) {
                handleAddItems(tableObj);
            }
        } catch (e) {
            console.error(e);
            setNotification({ type: 'error', message: 'Erro ao abrir mesa' });
        } finally {
            setCreating(false);
        }
    };

    if (loading && !tables.length) return <Loading fullScreen />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {notification && (
                <Notification
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Coffee size={14} /> {filteredTables.filter(t => t.status === 'open').length} mesa{filteredTables.filter(t => t.status === 'open').length !== 1 ? 's' : ''} aberta{filteredTables.filter(t => t.status === 'open').length !== 1 ? 's' : ''}
                    </div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>Mesas</h1>
                </div>
                {canWrite && (
                    <button onClick={() => setNewTableModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 20px', borderRadius: '10px', border: 'none', background: 'var(--gradient-primary)', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
                        <Plus size={18} /> Nova Mesa
                    </button>
                )}
            </div>

            {/* Filters */}
            <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <Input
                            ref={searchInputRef}
                            placeholder="Buscar por nome do cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon={<Search size={18} />}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { value: 'open', label: 'Abertas' },
                            { value: 'closed', label: 'Fechadas' },
                            { value: 'all', label: 'Todas' }
                        ].map(f => (
                            <button
                                key={f.value}
                                onClick={() => setStatusFilter(f.value)}
                                style={{
                                    padding: '7px 16px',
                                    borderRadius: '20px',
                                    border: '1px solid var(--color-border)',
                                    background: statusFilter === f.value ? 'var(--color-primary)' : 'transparent',
                                    color: statusFilter === f.value ? '#fff' : 'var(--color-text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    transition: 'all 0.15s'
                                }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tables Grid */}
            {filteredTables.length === 0 ? (
                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <Coffee size={40} style={{ opacity: 0.15, display: 'block', margin: '0 auto 10px' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>Nenhuma mesa encontrada</p>
                    <p style={{ margin: '4px 0 0', fontSize: '13px' }}>{statusFilter === 'open' ? 'Abra uma nova mesa para começar' : 'Sem mesas neste filtro'}</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 400px))',
                    gap: 'var(--spacing-md)'
                }}>
                    {filteredTables.map(table => {
                        const statusStyle = getStatusColor(table.status);
                        const itemCount = (table.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
                        const isOpen = table.status === 'open';

                        return (
                            <Card key={table.id} style={{ position: 'relative', overflow: 'hidden' }}>
                                {/* Status bar */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: '3px',
                                    background: statusStyle.color
                                }} />

                                <div style={{ padding: 'var(--spacing-md)', paddingTop: 'calc(var(--spacing-md) + 3px)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                    {/* Header: Name + Status + Total */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: 1, minWidth: 0 }}>
                                            <Users size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                            <span style={{
                                                fontSize: 'var(--font-size-md)',
                                                fontWeight: 700,
                                                color: 'var(--color-text-primary)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {table.customerName || 'Sem nome'}
                                            </span>
                                            <span style={{
                                                fontSize: '11px',
                                                padding: '3px 10px',
                                                borderRadius: '20px',
                                                fontWeight: 700,
                                                flexShrink: 0,
                                                ...statusStyle
                                            }}>
                                                {getStatusLabel(table.status)}
                                            </span>
                                        </div>
                                        <span style={{
                                            fontSize: 'var(--font-size-lg)',
                                            fontWeight: 700,
                                            color: 'var(--color-primary)',
                                            flexShrink: 0,
                                            marginLeft: 'var(--spacing-md)'
                                        }}>
                                            {formatCurrency(table.total || 0)}
                                        </span>
                                    </div>

                                    {/* Meta: time + items */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-md)',
                                        fontSize: 'var(--font-size-xs)',
                                        color: 'var(--color-text-muted)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={12} />
                                            <span>{table.createdAt && formatDateTime(table.createdAt)}</span>
                                            {isOpen && table.createdAt && (
                                                <span style={{
                                                    background: 'var(--color-bg-hover)',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    fontWeight: 600
                                                }}>
                                                    {getElapsedTime(table.createdAt)}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <ShoppingCart size={12} />
                                            <span>{itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{
                                        display: 'flex',
                                        gap: 'var(--spacing-xs)',
                                        borderTop: '1px solid var(--color-divider)',
                                        paddingTop: 'var(--spacing-sm)',
                                        alignItems: 'center'
                                    }}>
                                        <button
                                            onClick={() => handleViewTable(table)}
                                            title="Ver detalhes"
                                            style={{
                                                padding: '6px',
                                                background: 'transparent',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--color-text-secondary)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <Eye size={16} />
                                        </button>
                                        {isOpen && canWrite && (
                                            <>
                                                <Button variant="primary" size="sm" onClick={() => handleAddItems(table)} icon={<Plus size={14} />}>
                                                    Adicionar
                                                </Button>
                                                <Button variant="success" size="sm" onClick={() => handleCloseTable(table)} icon={<CheckCircle size={14} />}>
                                                    Fechar
                                                </Button>
                                                {(user?.role === 'admin' || user?.role === 'manager') && (
                                                    <button
                                                        onClick={() => handleCancelTable(table)}
                                                        title="Cancelar mesa"
                                                        style={{
                                                            padding: '6px',
                                                            background: 'transparent',
                                                            border: '1px solid var(--color-border)',
                                                            borderRadius: 'var(--radius-md)',
                                                            color: 'var(--color-danger)',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            marginLeft: 'auto'
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {!isOpen && (user?.role === 'admin' || user?.role === 'manager') && (
                                            <button
                                                onClick={() => handleCancelTable(table)}
                                                title="Excluir mesa fechada"
                                                style={{
                                                    padding: '6px',
                                                    background: 'transparent',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: 'var(--radius-md)',
                                                    color: 'var(--color-danger)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginLeft: 'auto'
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* New Table Modal */}
            <Modal
                isOpen={newTableModalOpen}
                onClose={() => { if (!creating) setNewTableModalOpen(false); }}
                title="Abrir Nova Mesa"
                size="sm"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <Input
                        label="Nome do Cliente *"
                        value={newTableName}
                        onChange={(e) => setNewTableName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !creating) handleCreateTable(); }}
                        placeholder="Ex: João, Mesa 1, Grupo Pedro..."
                        autoFocus
                        disabled={creating}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)' }}>
                        <Button variant="ghost" onClick={() => setNewTableModalOpen(false)} disabled={creating}>
                            Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleCreateTable}
                            loading={creating}
                            disabled={creating || !newTableName.trim()}
                        >
                            Abrir Mesa
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* View Table Modal */}
            <Modal
                isOpen={viewModalOpen}
                onClose={() => setViewModalOpen(false)}
                title={`Mesa: ${viewTable?.customerName || ''}`}
                size="md"
            >
                {viewTable && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            background: 'var(--color-bg-hover)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-size-sm)'
                        }}>
                            <span>Status: {getStatusLabel(viewTable.status)}</span>
                            <span>Aberta: {viewTable.createdAt && formatDateTime(viewTable.createdAt)}</span>
                        </div>

                        <div style={{
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr auto auto auto',
                                gap: 'var(--spacing-sm)',
                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                background: 'var(--color-bg-hover)',
                                fontWeight: 600,
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-text-secondary)'
                            }}>
                                <span>Produto</span>
                                <span style={{ textAlign: 'right' }}>Qtd</span>
                                <span style={{ textAlign: 'right' }}>Preço</span>
                                <span style={{ textAlign: 'right' }}>Total</span>
                            </div>
                            {(viewTable.items || []).map((item, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr auto auto auto',
                                        gap: 'var(--spacing-sm)',
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        borderTop: '1px solid var(--color-divider)',
                                        fontSize: 'var(--font-size-sm)'
                                    }}
                                >
                                    <span>
                                        {item.productName || item.name}
                                        {item.unit && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginLeft: '4px' }}>({item.unit.name})</span>}
                                    </span>
                                    <span style={{ textAlign: 'right' }}>{item.quantity}</span>
                                    <span style={{ textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</span>
                                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total || item.quantity * item.unitPrice)}</span>
                                </div>
                            ))}
                            {(!viewTable.items || viewTable.items.length === 0) && (
                                <div style={{
                                    padding: 'var(--spacing-lg)',
                                    textAlign: 'center',
                                    color: 'var(--color-text-muted)',
                                    fontSize: 'var(--font-size-sm)'
                                }}>
                                    Nenhum item adicionado
                                </div>
                            )}
                        </div>

                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: 'var(--spacing-md)',
                            background: 'var(--color-bg-hover)',
                            borderRadius: 'var(--radius-md)',
                            fontWeight: 700,
                            fontSize: 'var(--font-size-lg)'
                        }}>
                            <span>Total</span>
                            <span style={{ color: 'var(--color-primary)' }}>
                                {formatCurrency(viewTable.total || 0)}
                            </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)' }}>
                            <Button variant="ghost" onClick={() => setViewModalOpen(false)}>Fechar</Button>
                            {viewTable.status === 'open' && canWrite && (
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        setViewModalOpen(false);
                                        handleAddItems(viewTable);
                                    }}
                                    icon={<Plus size={16} />}
                                >
                                    Adicionar Itens
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default TablesPage;
