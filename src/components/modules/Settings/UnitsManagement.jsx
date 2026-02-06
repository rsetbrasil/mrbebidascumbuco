import React, { useState, useEffect } from 'react';
import { Ruler, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Notification from '../../common/Notification';
import { unitsService } from '../../../services/firestore';
import { useAuth } from '../../../contexts/AuthContext';

const UnitsManagement = () => {
    const { canWrite } = useAuth();
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingUnit, setEditingUnit] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [notification, setNotification] = useState(null);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        abbreviation: ''
    });

    useEffect(() => {
        loadUnits();
    }, []);

    const loadUnits = async () => {
        setLoading(true);
        try {
            // Initialize default units if needed
            await unitsService.initDefaultUnits();
            const data = await unitsService.getAll();
            setUnits(data);
        } catch (error) {
            console.error('Error loading units:', error);
            showNotification('error', 'Erro ao carregar unidades');
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.abbreviation) {
            showNotification('warning', 'Preencha todos os campos obrigatórios');
            return;
        }

        try {
            setSaving(true);
            if (editingUnit) {
                await unitsService.update(editingUnit.id, formData);
                showNotification('success', 'Unidade atualizada com sucesso');
            } else {
                await unitsService.create(formData);
                showNotification('success', 'Unidade criada com sucesso');
            }

            setIsFormOpen(false);
            setEditingUnit(null);
            resetForm();
            loadUnits();
        } catch (error) {
            console.error('Error saving unit:', error);
            showNotification('error', 'Erro ao salvar unidade');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (unit) => {
        setEditingUnit(unit);
        setFormData({
            name: unit.name,
            abbreviation: unit.abbreviation
        });
        setIsFormOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir esta unidade?')) return;

        try {
            await unitsService.delete(id);
            showNotification('success', 'Unidade excluída com sucesso');
            loadUnits();
        } catch (error) {
            console.error('Error deleting unit:', error);
            showNotification('error', 'Erro ao excluir unidade');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            abbreviation: ''
        });
    };

    return (
        <Card title="Gerenciamento de Unidades" icon={Ruler}>
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
                        {canWrite && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-md)' }}>
                                <Button
                                    onClick={() => {
                                        resetForm();
                                        setEditingUnit(null);
                                        setIsFormOpen(true);
                                    }}
                                    icon={<Plus size={18} />}
                                    variant="primary"
                                >
                                    Nova Unidade
                                </Button>
                            </div>
                        )}

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                                        <th style={{ padding: 'var(--spacing-sm)' }}>Nome</th>
                                        <th style={{ padding: 'var(--spacing-sm)' }}>Sigla</th>
                                        <th style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {units.map(unit => (
                                        <tr key={unit.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: 'var(--spacing-sm)' }}>{unit.name}</td>
                                            <td style={{ padding: 'var(--spacing-sm)' }}>
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: 'var(--color-bg-tertiary)',
                                                    fontSize: '12px',
                                                    fontWeight: 600
                                                }}>
                                                    {unit.abbreviation}
                                                </span>
                                            </td>
                                            <td style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>
                                                {canWrite && (
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                        <button
                                                            onClick={() => handleEdit(unit)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-primary)' }}
                                                        >
                                                            <Edit size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(unit.id)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {units.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan="3" style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                                                Nenhuma unidade cadastrada
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3>{editingUnit ? 'Editar Unidade' : 'Nova Unidade'}</h3>
                            <button
                                type="button"
                                onClick={() => setIsFormOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
                                disabled={saving}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                            <Input
                                label="Nome da Unidade"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                placeholder="Ex: Garrafa"
                                required
                                disabled={saving}
                            />

                            <Input
                                label="Sigla"
                                name="abbreviation"
                                value={formData.abbreviation}
                                onChange={handleInputChange}
                                placeholder="Ex: GF"
                                required
                                maxLength={5}
                                disabled={saving}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
                            <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)} disabled={saving}>
                                Cancelar
                            </Button>
                            <Button type="submit" variant="primary" icon={<Save size={18} />} loading={saving}>
                                Salvar
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </Card >
    );
};

export default UnitsManagement;
