import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Notification from '../../common/Notification';
import { userService } from '../../../services/firestore';

const UsersManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [notification, setNotification] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        username: '',
        password: '',
        role: 'seller', // seller, manager, cashier
        active: true
    });

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await userService.getAll();
            setUsers(data);
        } catch (error) {
            console.error('Error loading users:', error);
            showNotification('error', 'Erro ao carregar usuários');
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.username || !formData.password) {
            showNotification('warning', 'Preencha todos os campos obrigatórios');
            return;
        }

        try {
            if (editingUser) {
                await userService.update(editingUser.id, formData);
                showNotification('success', 'Usuário atualizado com sucesso');
            } else {
                await userService.create(formData);
                showNotification('success', 'Usuário criado com sucesso');
            }

            setIsFormOpen(false);
            setEditingUser(null);
            resetForm();
            loadUsers();
        } catch (error) {
            console.error('Error saving user:', error);
            showNotification('error', error.message || 'Erro ao salvar usuário');
        }
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            username: user.username,
            password: user.password,
            role: user.role,
            active: user.active
        });
        setIsFormOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este usuário?')) return;

        try {
            await userService.delete(id);
            showNotification('success', 'Usuário excluído com sucesso');
            loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            showNotification('error', 'Erro ao excluir usuário');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            username: '',
            password: '',
            role: 'seller',
            active: true
        });
    };

    return (
        <Card title="Gerenciamento de Usuários" icon={Users}>
            {notification && (
                <Notification
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}

            <div style={{ padding: 'var(--spacing-md)' }}>
                {!isFormOpen ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-md)' }}>
                            <Button
                                onClick={() => {
                                    resetForm();
                                    setEditingUser(null);
                                    setIsFormOpen(true);
                                }}
                                icon={<Plus size={18} />}
                                variant="primary"
                            >
                                Novo Usuário
                            </Button>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                                        <th style={{ padding: 'var(--spacing-sm)' }}>Nome</th>
                                        <th style={{ padding: 'var(--spacing-sm)' }}>Usuário</th>
                                        <th style={{ padding: 'var(--spacing-sm)' }}>Função</th>
                                        <th style={{ padding: 'var(--spacing-sm)' }}>Status</th>
                                        <th style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(user => (
                                        <tr key={user.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: 'var(--spacing-sm)' }}>{user.name}</td>
                                            <td style={{ padding: 'var(--spacing-sm)' }}>{user.username}</td>
                                            <td style={{ padding: 'var(--spacing-sm)' }}>
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: user.role === 'manager' ? 'var(--color-primary)' : (user.role === 'cashier' ? 'var(--color-warning)' : 'var(--color-secondary)'),
                                                    color: 'white',
                                                    fontSize: '12px'
                                                }}>
                                                    {user.role === 'manager' ? 'Gerente' : (user.role === 'cashier' ? 'Caixa' : 'Vendedor')}
                                                </span>
                                            </td>
                                            <td style={{ padding: 'var(--spacing-sm)' }}>
                                                <span style={{
                                                    color: user.active ? 'var(--color-success)' : 'var(--color-danger)'
                                                }}>
                                                    {user.active ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </td>
                                            <td style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                    <button
                                                        onClick={() => handleEdit(user)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-primary)' }}
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                    {user.username !== 'admin' && (
                                                        <button
                                                            onClick={() => handleDelete(user.id)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                            <button
                                type="button"
                                onClick={() => setIsFormOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                            <Input
                                label="Nome Completo"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                required
                            />

                            <Input
                                label="Nome de Usuário"
                                name="username"
                                value={formData.username}
                                onChange={handleInputChange}
                                required
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                            <Input
                                label="Senha"
                                name="password"
                                type="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                required
                            />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Função</label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleInputChange}
                                    style={{
                                        padding: '10px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        background: 'var(--color-bg-primary)',
                                        color: 'var(--color-text-primary)',
                                        height: '42px'
                                    }}
                                >
                                    <option value="seller">Vendedor</option>
                                    <option value="cashier">Caixa</option>
                                    <option value="manager">Gerente</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="checkbox"
                                name="active"
                                checked={formData.active}
                                onChange={handleInputChange}
                                id="active-check"
                            />
                            <label htmlFor="active-check">Usuário Ativo</label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
                            <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" variant="primary" icon={<Save size={18} />}>
                                Salvar
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </Card>
    );
};

export default UsersManagement;
