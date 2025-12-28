import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Users, Phone, FileText } from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Loading from '../../common/Loading';
import Notification from '../../common/Notification';
import CustomerModal from './CustomerModal';
import { customerService } from '../../../services/firestore';

const CustomersPage = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await customerService.getAll();
            setCustomers(data);
        } catch (error) {
            console.error('Error loading customers:', error);
            showNotification('error', 'Erro ao carregar clientes');
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleSave = async (customerData) => {
        try {
            if (editingCustomer) {
                await customerService.update(editingCustomer.id, customerData);
                showNotification('success', 'Cliente atualizado com sucesso');
            } else {
                await customerService.create(customerData);
                showNotification('success', 'Cliente criado com sucesso');
            }
            loadData();
        } catch (error) {
            console.error('Error saving customer:', error);
            showNotification('error', 'Erro ao salvar cliente');
            throw error;
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este cliente?')) return;

        try {
            await customerService.delete(id);
            showNotification('success', 'Cliente excluído com sucesso');
            loadData();
        } catch (error) {
            console.error('Error deleting customer:', error);
            showNotification('error', 'Erro ao excluir cliente');
        }
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.document && c.document.includes(searchTerm)) ||
        (c.phone && c.phone.includes(searchTerm))
    );

    if (loading && !customers.length) return <Loading fullScreen />;

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
                    }}>Clientes</h1>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Gerencie sua base de clientes</p>
                </div>
                {canWrite && (
                    <Button
                        onClick={() => {
                            setEditingCustomer(null);
                            setIsModalOpen(true);
                        }}
                        icon={<Plus size={20} />}
                    >
                        Novo Cliente
                    </Button>
                )}
            </div>

            <Card>
                <div style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ maxWidth: '400px' }}>
                        <Input
                            placeholder="Buscar por nome, CPF ou telefone..."
                            icon={Search}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Nome</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Documento</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Contato</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Tipo</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600, textAlign: 'right' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <Users size={48} style={{ opacity: 0.2 }} />
                                            <p>Nenhum cliente encontrado</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <tr key={customer.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                                        <td style={{ padding: 'var(--spacing-md)' }}>
                                            <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{customer.name}</div>
                                            {customer.email && (
                                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{customer.email}</div>
                                            )}
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
                                            {customer.document ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <FileText size={14} style={{ color: 'var(--color-text-muted)' }} />
                                                    <span>{customer.document}</span>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                                            )}
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
                                            {customer.phone ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Phone size={14} style={{ color: 'var(--color-text-muted)' }} />
                                                    <span>{customer.phone}</span>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                                            )}
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                backgroundColor: customer.priceType === 'wholesale' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                                color: customer.priceType === 'wholesale' ? '#a78bfa' : '#60a5fa',
                                                border: `1px solid ${customer.priceType === 'wholesale' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`
                                            }}>
                                                {customer.priceType === 'wholesale' ? 'Atacado' : 'Varejo'}
                                            </span>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
                                                <button
                                                    onClick={() => {
                                                        setEditingCustomer(customer);
                                                        setIsModalOpen(true);
                                                    }}
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
                                                <button
                                                    onClick={() => handleDelete(customer.id)}
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
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <CustomerModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                customer={editingCustomer}
            />
        </div>
    );
};

export default CustomersPage;
