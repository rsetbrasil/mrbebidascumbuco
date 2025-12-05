import React, { useState, useEffect } from 'react';
import { X, Save, Plus } from 'lucide-react';
import Modal from '../../common/Modal';
import Input from '../../common/Input';
import CurrencyInput from '../../common/CurrencyInput';
import Button from '../../common/Button';
import { categoryService, unitsService } from '../../../services/firestore';
import { parseCurrency, formatCurrency } from '../../../utils/formatters';

const ProductModal = ({ isOpen, onClose, onSave, product = null }) => {
    const [formData, setFormData] = useState({
        name: '',
        barcode: '',
        wholesalePrice: '',
        coldPrice: '',
        cost: '',
        stock: '',
        coldStock: '',
        categoryId: '',
        wholesaleUnit: 'UN',
        coldUnit: 'UN',
        active: true
    });

    const [categories, setCategories] = useState([]);
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [newUnit, setNewUnit] = useState({
        name: '',
        multiplier: '',
        barcode: '',
        price: ''
    });

    useEffect(() => {
        loadCategories();
        loadUnits();
    }, []);

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name || '',
                barcode: product.barcode || '',
                wholesalePrice: product.wholesalePrice || product.price || '',
                coldPrice: product.coldPrice || '',
                cost: product.cost || '',
                stock: product.stock || '',
                coldStock: product.coldStock || '',
                categoryId: product.categoryId || '',
                wholesaleUnit: product.wholesaleUnit || product.unitOfMeasure || 'UN',
                coldUnit: product.coldUnit || product.unitOfMeasure || 'UN',
                active: product.active !== undefined ? product.active : true
            });
        } else {
            setFormData({
                name: '',
                barcode: '',
                wholesalePrice: '',
                coldPrice: '',
                cost: '',
                stock: '',
                coldStock: '',
                categoryId: '',
                wholesaleUnit: 'UN',
                coldUnit: 'UN',
                active: true
            });
        }
        setErrors({});
    }, [product, isOpen]);

    const loadCategories = async () => {
        try {
            const data = await categoryService.getAll();
            setCategories(data);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const loadUnits = async () => {
        try {
            await unitsService.initDefaultUnits(); // Ensure defaults exist
            const data = await unitsService.getAll();
            setUnits(data);
        } catch (error) {
            console.error('Error loading units:', error);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório';
        if (!formData.wholesalePrice) newErrors.wholesalePrice = 'Preço é obrigatório';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAddUnit = () => {
        if (!newUnit.name || !newUnit.multiplier || !newUnit.price) return;

        setFormData(prev => ({
            ...prev,
            units: [...(prev.units || []), {
                ...newUnit,
                multiplier: parseInt(newUnit.multiplier) || 1,
                price: parseFloat(newUnit.price) || 0
            }]
        }));
        setNewUnit({ name: '', multiplier: '', barcode: '', price: '' });
    };

    const handleRemoveUnit = (index) => {
        setFormData(prev => ({
            ...prev,
            units: prev.units.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            const productData = {
                ...formData,
                price: parseFloat(formData.wholesalePrice) || 0,
                wholesalePrice: parseFloat(formData.wholesalePrice) || 0,
                coldPrice: parseFloat(formData.coldPrice) || 0,
                cost: parseFloat(formData.cost) || 0,
                stock: parseInt(formData.stock) || 0,
                coldStock: parseInt(formData.coldStock) || 0
            };

            await onSave(productData);
            onClose();
        } catch (error) {
            console.error('Error saving product:', error);
            setErrors({ submit: 'Erro ao salvar produto' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={product ? 'Editar Produto' : 'Novo Produto'}
            size="xl"
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                    <Input
                        label="Nome do Produto"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        error={errors.name}
                        placeholder="Ex: Coca-Cola 2L"
                        autoFocus
                    />

                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                            <Input
                                label="Código de Barras"
                                name="barcode"
                                value={formData.barcode}
                                onChange={handleChange}
                                placeholder="Escaneie ou digite"
                            />
                        </div>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                const randomDigits = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
                                const newBarcode = `2${randomDigits}`;
                                setFormData(prev => ({ ...prev, barcode: newBarcode }));
                            }}
                            title="Gerar código aleatório"
                            style={{ marginBottom: '2px' }}
                        >
                            Gerar
                        </Button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-md)' }}>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                            <CurrencyInput
                                label="Preço (Atacado)"
                                name="wholesalePrice"
                                value={formData.wholesalePrice}
                                onChange={handleChange}
                                placeholder="0,00"
                            />
                        </div>
                        <div style={{ width: '70px' }}>
                            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                                Un.
                            </label>
                            <select
                                name="wholesaleUnit"
                                value={formData.wholesaleUnit}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    height: '42px',
                                    background: 'var(--color-bg-tertiary)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '0 4px',
                                    color: 'var(--color-text-primary)',
                                    outline: 'none',
                                    fontSize: '13px'
                                }}
                            >
                                {units.map(unit => (
                                    <option key={unit.id} value={unit.abbreviation}>{unit.abbreviation}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                            <CurrencyInput
                                label="Preço (Gelada)"
                                name="coldPrice"
                                value={formData.coldPrice}
                                onChange={handleChange}
                                placeholder="0,00"
                            />
                        </div>
                        <div style={{ width: '70px' }}>
                            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                                Un.
                            </label>
                            <select
                                name="coldUnit"
                                value={formData.coldUnit}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    height: '42px',
                                    background: 'var(--color-bg-tertiary)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '0 4px',
                                    color: 'var(--color-text-primary)',
                                    outline: 'none',
                                    fontSize: '13px'
                                }}
                            >
                                {units.map(unit => (
                                    <option key={unit.id} value={unit.abbreviation}>{unit.abbreviation}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <CurrencyInput
                        label="Preço Custo (R$)"
                        name="cost"
                        value={formData.cost}
                        onChange={handleChange}
                        placeholder="0,00"
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-md)' }}>
                    <Input
                        label="Estoque Atual"
                        name="stock"
                        type="number"
                        value={formData.stock}
                        onChange={handleChange}
                        placeholder="0"
                    />

                    <Input
                        label="Estoque Gelado"
                        name="coldStock"
                        type="number"
                        value={formData.coldStock}
                        onChange={handleChange}
                        placeholder="0"
                    />

                    <div>
                        <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                            Categoria
                        </label>
                        <select
                            name="categoryId"
                            value={formData.categoryId}
                            onChange={handleChange}
                            style={{
                                width: '100%',
                                height: '42px',
                                background: 'var(--color-bg-tertiary)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                padding: '0 16px',
                                color: 'var(--color-text-primary)',
                                outline: 'none',
                                transition: 'border-color var(--transition-fast)',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}>Selecione uma categoria</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id} style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', paddingTop: 'var(--spacing-xs)' }}>
                    <input
                        type="checkbox"
                        id="active"
                        name="active"
                        checked={formData.active}
                        onChange={handleChange}
                        style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '4px',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-tertiary)',
                            cursor: 'pointer'
                        }}
                    />
                    <label htmlFor="active" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                        Produto Ativo
                    </label>
                </div>

                {/* Additional Units Section */}
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-md)', marginTop: 'var(--spacing-sm)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>Unidades Adicionais (Fardos, Kits)</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 1.5fr auto', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)', alignItems: 'flex-end' }}>
                        <Input
                            label="Nome (ex: Fardo)"
                            value={newUnit.name}
                            onChange={(e) => setNewUnit(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Nome da unidade"
                        />
                        <Input
                            label="Qtd. Itens"
                            type="number"
                            value={newUnit.multiplier}
                            onChange={(e) => setNewUnit(prev => ({ ...prev, multiplier: e.target.value }))}
                            placeholder="12"
                        />
                        <Input
                            label="Cód. Barras"
                            value={newUnit.barcode}
                            onChange={(e) => setNewUnit(prev => ({ ...prev, barcode: e.target.value }))}
                            placeholder="Código do fardo"
                        />
                        <CurrencyInput
                            label="Preço (R$)"
                            value={newUnit.price}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '') / 100;
                                setNewUnit(prev => ({ ...prev, price: val }));
                            }}
                            placeholder="0,00"
                        />
                        <Button
                            type="button"
                            onClick={handleAddUnit}
                            disabled={!newUnit.name || !newUnit.multiplier || !newUnit.price}
                            icon={<Plus size={18} />}
                            style={{ marginBottom: '2px' }}
                        >
                            Add
                        </Button>
                    </div>

                    {formData.units && formData.units.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                            {formData.units.map((unit, index) => (
                                <div key={index} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: 'var(--spacing-sm)',
                                    background: 'var(--color-bg-secondary)',
                                    borderRadius: 'var(--radius-sm)'
                                }}>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)' }}>
                                        <span style={{ fontWeight: 600 }}>{unit.name}</span>
                                        <span style={{ color: 'var(--color-text-secondary)' }}>x{unit.multiplier}</span>
                                        <span style={{ color: 'var(--color-text-secondary)' }}>{unit.barcode || '-'}</span>
                                        <span style={{ fontWeight: 500, color: 'var(--color-success)' }}>{formatCurrency(unit.price)}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveUnit(index)}
                                        style={{ color: 'var(--color-danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--color-border)', marginTop: 'var(--spacing-md)' }}>
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
                        icon={<Save size={18} />}
                    >
                        Salvar Produto
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default ProductModal;
