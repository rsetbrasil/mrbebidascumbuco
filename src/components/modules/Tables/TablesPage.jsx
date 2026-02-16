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
        const unsub = tablesService.subscribeAll((data) => {
            setTables(data);
            setLoading(false);
        });
        return () => { try { unsub && unsub(); } catch { } };
    }, []);

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleCreateTable = async () => {
        if (!newTableName.trim()) {
            showNotification('error', 'Informe o nome do cliente');
            return;
        }
        if (creating) return;
        setCreating(true);
        try {
            await tablesService.create({
                customerName: newTableName.trim(),
                priceType: 'wholesale',
                createdBy: user?.uid || null
            });
            showNotification('success', `Mesa "${newTableName.trim()}" aberta com sucesso`);
            setNewTableName('');
            setNewTableModalOpen(false);
        } catch (error) {
            console.error('Error creating table:', error);
            showNotification('error', 'Erro ao abrir mesa');
        } finally {
            setCreating(false);
        }
    };

    const handleAddItems = (table) => {
        try {
            loadTable(table);
            navigate('/sales');
        } catch (error) {
            console.error('Error loading table:', error);
            showNotification('error', 'Erro ao carregar mesa');
        }
    };

    const handleCloseTable = (table) => {
        try {
            loadTable(table);
            navigate('/sales');
        } catch (error) {
            console.error('Error loading table for closing:', error);
            showNotification('error', 'Erro ao carregar mesa');
        }
    };

    const handleCancelTable = async (table) => {
        if (!window.confirm(`Tem certeza que deseja cancelar a mesa "${table.customerName}"?`)) return;
        try {
            await tablesService.update(table.id, { status: 'cancelled', closedAt: new Date() });
            showNotification('success', 'Mesa cancelada com sucesso');
        } catch (error) {
            console.error('Error cancelling table:', error);
            showNotification('error', 'Erro ao cancelar mesa');
        }
    };

    const handleViewTable = (table) => {
        setViewTable(table);
        setViewModalOpen(true);
    };

    const filteredTables = (tables || []).filter(t => {
        const matchesSearch =
            (t.customerName && t.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            t.id.toLowerCase().includes(searchTerm.toLowerCase());

        const tStatus = t.status || 'open';
        const matchesStatus =
            statusFilter === 'all' || tStatus === statusFilter;

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                    <Coffee size={28} style={{ color: 'var(--color-primary)' }} />
                    <div>
                        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: 0 }}>
                            Mesas
                        </h1>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                            {filteredTables.filter(t => t.status === 'open').length} mesa(s) aberta(s)
                        </p>
                    </div>
                </div>
                {canWrite && (
                    <Button
                        onClick={() => setNewTableModalOpen(true)}
                        icon={<Plus size={18} />}
                    >
                        Nova Mesa
                    </Button>
                )}
            </div>

            {/* Filters */}
            <Card>
                <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <Input
                            ref={searchInputRef}
                            placeholder="Buscar por nome do cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon={<Search size={18} />}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                        {[
                            { value: 'open', label: 'Abertas' },
                            { value: 'closed', label: 'Fechadas' },
                            { value: 'all', label: 'Todas' }
                        ].map(f => (
                            <button
                                key={f.value}
                                onClick={() => setStatusFilter(f.value)}
                                style={{
                                    padding: 'var(--spacing-sm) var(--spacing-md)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    background: statusFilter === f.value ? 'var(--color-primary)' : 'transparent',
                                    color: statusFilter === f.value ? '#fff' : 'var(--color-text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: 'var(--font-size-sm)',
                                    fontWeight: 500,
                                    transition: 'all var(--transition-fast)'
                                }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </Card>

            {/* Tables Grid */}
            {filteredTables.length === 0 ? (
                <Card>
                    <div style={{
                        textAlign: 'center',
                        padding: 'var(--spacing-2xl)',
                        color: 'var(--color-text-secondary)'
                    }}>
                        <Coffee size={48} style={{ marginBottom: 'var(--spacing-md)', opacity: 0.5 }} />
                        <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
                            Nenhuma mesa encontrada
                        </p>
                        <p style={{ fontSize: 'var(--font-size-sm)' }}>
                            {statusFilter === 'open' ? 'Abra uma nova mesa para começar' : 'Sem mesas neste filtro'}
                        </p>
                    </div>
                </Card>
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
                                                fontSize: 'var(--font-size-xs)',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontWeight: 600,
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
