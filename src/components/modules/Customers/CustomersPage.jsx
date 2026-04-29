import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Users, Phone, FileText } from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Loading from '../../common/Loading';
import Notification from '../../common/Notification';
import CustomerModal from './CustomerModal';
import { customerService } from '../../../services/firestore';
import { useAuth } from '../../../contexts/AuthContext';

const CustomersPage = () => {
    const { canWrite } = useAuth();
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {notification && (
                <Notification type={notification.type} message={notification.message} onClose={() => setNotification(null)} />
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={14} /> {filteredCustomers.length} cliente{filteredCustomers.length !== 1 ? 's' : ''}
                    </div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>Clientes</h1>
                </div>
                {canWrite && (
                    <button
                        onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 20px', borderRadius: '10px', border: 'none', background: 'var(--gradient-primary)', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}
                    >
                        <Plus size={18} /> Novo Cliente
                    </button>
                )}
            </div>

            {/* Tabela */}
            <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ maxWidth: '380px' }}>
                        <Input placeholder="Buscar por nome, CPF ou telefone..." icon={Search} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                {['Nome', 'Documento', 'Contato', 'Tipo', 'Ações'].map((h, i) => (
                                    <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i === 4 ? 'right' : 'left' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        <Users size={40} style={{ opacity: 0.15, marginBottom: '10px', display: 'block', margin: '0 auto 10px' }} />
                                        <p style={{ margin: 0 }}>Nenhum cliente encontrado</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <tr key={customer.id} style={{ borderBottom: '1px solid var(--color-divider)', transition: 'background 0.1s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                                        <td style={{ padding: '13px 16px' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{customer.name}</div>
                                            {customer.email && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{customer.email}</div>}
                                        </td>
                                        <td style={{ padding: '13px 16px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                                            {customer.document ? <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={13} style={{ color: 'var(--color-text-muted)' }} />{customer.document}</div> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '13px 16px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                                            {customer.phone ? <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={13} style={{ color: 'var(--color-text-muted)' }} />{customer.phone}</div> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '13px 16px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: customer.priceType === 'wholesale' ? '#8b5cf618' : '#3b82f618', color: customer.priceType === 'wholesale' ? '#8b5cf6' : '#3b82f6' }}>
                                                {customer.priceType === 'wholesale' ? 'Atacado' : 'Varejo'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                                                <button onClick={() => { setEditingCustomer(customer); setIsModalOpen(true); }} style={{ padding: '7px', background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', borderRadius: '8px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Editar"><Edit size={16} /></button>
                                                <button onClick={() => handleDelete(customer.id)} style={{ padding: '7px', background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', borderRadius: '8px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Excluir"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
