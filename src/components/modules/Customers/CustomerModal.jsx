import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import Modal from '../../common/Modal';
import Input from '../../common/Input';
import Button from '../../common/Button';
import { formatPhone, formatDocument } from '../../../utils/formatters';

const CustomerModal = ({ isOpen, onClose, onSave, customer = null }) => {
    const [formData, setFormData] = useState({
        name: '',
        document: '',
        phone: '',
        email: '',
        address: '',
        priceType: 'retail'
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (customer) {
            setFormData({
                name: customer.name || '',
                document: customer.document || '',
                phone: customer.phone || '',
                email: customer.email || '',
                address: customer.address || '',
                priceType: customer.priceType || 'retail'
            });
        } else {
            setFormData({
                name: '',
                document: '',
                phone: '',
                email: '',
                address: '',
                priceType: 'retail'
            });
        }
        setErrors({});
    }, [customer, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        let formattedValue = value;

        // Auto-format fields
        if (name === 'phone') formattedValue = formatPhone(value);
        if (name === 'document') formattedValue = formatDocument(value);

        setFormData(prev => ({
            ...prev,
            [name]: formattedValue
        }));

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error('Error saving customer:', error);
            setErrors({ submit: 'Erro ao salvar cliente' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={customer ? 'Editar Cliente' : 'Novo Cliente'}
            size="md"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Nome Completo"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    error={errors.name}
                    placeholder="Ex: João da Silva"
                    autoFocus
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="CPF / CNPJ"
                        name="document"
                        value={formData.document}
                        onChange={handleChange}
                        placeholder="000.000.000-00"
                        maxLength={18}
                    />

                    <Input
                        label="Telefone / WhatsApp"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                    />
                </div>

                <Input
                    label="E-mail"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="exemplo@email.com"
                />

                <Input
                    label="Endereço"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Rua, Número, Bairro"
                    textarea
                />

                <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                        Tabela de Preço Padrão
                    </label>
                    <select
                        name="priceType"
                        value={formData.priceType}
                        onChange={handleChange}
                        style={{
                            width: '100%',
                            background: 'var(--color-bg-input)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '10px 16px',
                            color: 'var(--color-text-primary)',
                            outline: 'none'
                        }}
                    >
                        <option value="retail">Varejo (Padrão)</option>
                        <option value="wholesale">Atacado</option>
                    </select>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700 mt-6">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        loading={loading}
                        icon={Save}
                    >
                        Salvar Cliente
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default CustomerModal;
