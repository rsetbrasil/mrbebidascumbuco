import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Save, X, Tag } from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Modal from '../../common/Modal';
import { categoryService } from '../../../services/firestore';
import { useApp } from '../../../contexts/AppContext';

const CategoriesPage = () => {
    const { showNotification } = useApp();
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
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)' }}>
                <h1>Categorias</h1>
                <Button
                    variant="primary"
                    icon={<Plus size={20} />}
                    onClick={() => handleOpenModal()}
                >
                    Nova Categoria
                </Button>
            </div>

            <Card>
                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <Input
                        placeholder="Buscar categorias..."
                        value={searchTerm}
                        onChange={handleSearch}
                        icon={<Search size={20} />}
                    />
                </div>

                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Descrição</th>
                                <th style={{ width: '100px', textAlign: 'center' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="3" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                                        Carregando...
                                    </td>
                                </tr>
                            ) : filteredCategories.length === 0 ? (
                                <tr>
                                    <td colSpan="3" style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                                        Nenhuma categoria encontrada
                                    </td>
                                </tr>
                            ) : (
                                filteredCategories.map(category => (
                                    <tr key={category.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    background: 'var(--color-bg-tertiary)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'var(--color-primary)'
                                                }}>
                                                    <Tag size={16} />
                                                </div>
                                                <span style={{ fontWeight: 500 }}>{category.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--color-text-secondary)' }}>
                                            {category.description || '-'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-sm)' }}>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={<Edit size={16} />}
                                                    onClick={() => handleOpenModal(category)}
                                                    title="Editar"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={<Trash2 size={16} />}
                                                    onClick={() => handleDelete(category.id)}
                                                    style={{ color: 'var(--color-danger)' }}
                                                    title="Excluir"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

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
