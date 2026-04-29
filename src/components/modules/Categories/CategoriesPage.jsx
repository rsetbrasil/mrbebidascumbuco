import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Save, X, Tag } from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Modal from '../../common/Modal';
import { categoryService } from '../../../services/firestore';
import { useApp } from '../../../contexts/AppContext';
import { useAuth } from '../../../contexts/AuthContext';

const CategoriesPage = () => {
    const { showNotification } = useApp();
    const { canWrite } = useAuth();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            setLoading(true);
            const data = await categoryService.getAll();
            setCategories(data);
        } catch (error) {
            console.error('Error loading categories:', error);
            showNotification('Erro ao carregar categorias', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    const filteredCategories = categories
        .filter(cat =>
            cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (cat.description && cat.description.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

    const handleOpenModal = (category = null) => {
        if (category) {
            setEditingCategory(category);
            setFormData({ name: category.name, description: category.description || '' });
        } else {
            setEditingCategory(null);
            setFormData({ name: '', description: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null);
        setFormData({ name: '', description: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            showNotification('Nome da categoria é obrigatório', 'warning');
            return;
        }

        try {
            setSaving(true);
            if (editingCategory) {
                await categoryService.update(editingCategory.id, formData);
                showNotification('Categoria atualizada com sucesso', 'success');
            } else {
                await categoryService.create(formData);
                showNotification('Categoria criada com sucesso', 'success');
            }
            handleCloseModal();
            loadCategories();
        } catch (error) {
            console.error('Error saving category:', error);
            showNotification('Erro ao salvar categoria', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir esta categoria?')) return;

        try {
            await categoryService.delete(id);
            showNotification('Categoria excluída com sucesso', 'success');
            loadCategories();
        } catch (error) {
            console.error('Error deleting category:', error);
            showNotification('Erro ao excluir categoria', 'error');
        }
    };

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Tag size={14} /> {filteredCategories.length} categori{filteredCategories.length !== 1 ? 'as' : 'a'}
                    </div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>Categorias</h1>
                </div>
                {canWrite && (
                    <button onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 20px', borderRadius: '10px', border: 'none', background: 'var(--gradient-primary)', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
                        <Plus size={18} /> Nova Categoria
                    </button>
                )}
            </div>

            {/* Tabela */}
            <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ maxWidth: '380px' }}>
                        <Input placeholder="Buscar categorias..." value={searchTerm} onChange={handleSearch} icon={<Search size={18} />} />
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                {['Nome', 'Descrição', 'Ações'].map((h, i) => (
                                    <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i === 2 ? 'center' : 'left', width: i === 2 ? '100px' : undefined }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="3" style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</td></tr>
                            ) : filteredCategories.length === 0 ? (
                                <tr><td colSpan="3" style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                    <Tag size={40} style={{ opacity: 0.15, display: 'block', margin: '0 auto 10px' }} />
                                    Nenhuma categoria encontrada
                                </td></tr>
                            ) : (
                                filteredCategories.map(category => (
                                    <tr key={category.id} style={{ borderBottom: '1px solid var(--color-divider)', transition: 'background 0.1s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                                        <td style={{ padding: '13px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#6366f118', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', flexShrink: 0 }}>
                                                    <Tag size={16} />
                                                </div>
                                                <span style={{ fontWeight: 600 }}>{category.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '13px 16px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>{category.description || '—'}</td>
                                        <td style={{ padding: '13px 16px' }}>
                                            {canWrite && (
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                                                    <button onClick={() => handleOpenModal(category)} style={{ padding: '7px', background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', borderRadius: '8px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Editar"><Edit size={16} /></button>
                                                    <button onClick={() => handleDelete(category.id)} style={{ padding: '7px', background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', borderRadius: '8px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Excluir"><Trash2 size={16} /></button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                size="sm"
            >
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <Input
                        label="Nome da Categoria"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        autoFocus
                        placeholder="Ex: Refrigerantes"
                    />

                    <Input
                        label="Descrição (Opcional)"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Ex: Refrigerantes diversos"
                        textarea
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-sm)' }}>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleCloseModal}
                            disabled={saving}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            loading={saving}
                            icon={<Save size={18} />}
                        >
                            Salvar
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default CategoriesPage;
