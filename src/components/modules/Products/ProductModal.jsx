import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import Modal from '../../common/Modal';
import Input from '../../common/Input';
import CurrencyInput from '../../common/CurrencyInput';
import Button from '../../common/Button';
import { categoryService, unitsService } from '../../../services/firestore';
 

const ProductModal = ({ isOpen, onClose, onSave, product = null }) => {
    const [formData, setFormData] = useState({
        name: '',
        barcode: '',
        wholesalePrice: '',
        coldPrice: '',
        cost: '',
        coldCost: '',
        stock: '',
        coldStock: '',
        categoryId: '',
        wholesaleUnit: 'UN',
        coldUnit: 'UN',
        wholesaleUnitMultiplier: 1,
        coldUnitMultiplier: 1,
        active: true
    });

    const [categories, setCategories] = useState([]);
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        loadCategories();
        loadUnits();
    }, []);

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name || '',
                barcode: product.barcode || '',
                wholesalePrice: product.wholesalePrice === null ? '' : (product.wholesalePrice ?? product.price ?? ''),
                coldPrice: product.coldPrice === null ? '' : (product.coldPrice ?? ''),
                cost: product.cost || '',
                coldCost: product.coldCost || '',
                stock: product.stock || '',
                coldStock: product.coldStock || '',
                categoryId: product.categoryId || '',
                wholesaleUnit: product.wholesaleUnit || product.unitOfMeasure || 'UN',
                coldUnit: product.coldUnit || product.unitOfMeasure || 'UN',
                wholesaleUnitMultiplier: product.wholesaleUnitMultiplier || 1,
                coldUnitMultiplier: product.coldUnitMultiplier || 1,
                active: product.active !== undefined ? product.active : true
            });
        } else {
            setFormData({
                name: '',
                barcode: '',
                wholesalePrice: '',
                coldPrice: '',
                cost: '',
                coldCost: '',
                stock: '',
                coldStock: '',
                categoryId: '',
                wholesaleUnit: 'UN',
                coldUnit: 'UN',
                wholesaleUnitMultiplier: 1,
                coldUnitMultiplier: 1,
                active: true
            });
        }
        setErrors({});
    }, [product, isOpen]);

    const loadCategories = async () => {
        try {
            const data = await categoryService.getAll();
            const sorted = [...data].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
            setCategories(sorted);
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
        const wholesaleOk = formData.wholesalePrice !== '' && Number(formData.wholesalePrice) > 0;
        const coldOk = formData.coldPrice !== '' && Number(formData.coldPrice) > 0;
        if (!wholesaleOk && !coldOk) {
            const msg = 'Informe o preço do Atacado ou da Mercearia';
            newErrors.wholesalePrice = msg;
            newErrors.coldPrice = msg;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

 

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            const normalizeMoney = (v) => {
                if (v === '' || v === null || v === undefined) return null;
                const n = typeof v === 'string' ? parseFloat(v) : Number(v);
                return Number.isFinite(n) ? n : null;
            };
            const wholesalePrice = normalizeMoney(formData.wholesalePrice);
            const coldPrice = normalizeMoney(formData.coldPrice);
            const cost = normalizeMoney(formData.cost);
            const coldCost = normalizeMoney(formData.coldCost);
            const basePrice = wholesalePrice ?? coldPrice ?? 0;

            const productData = {
                ...formData,
                price: basePrice,
                wholesalePrice,
                coldPrice,
                cost: cost ?? 0,
                coldCost: coldCost ?? 0,
                stock: parseInt(formData.stock) || 0,
                coldStock: parseInt(formData.coldStock) || 0
            };
            productData.wholesaleUnitMultiplier = Math.max(1, parseInt(formData.wholesaleUnitMultiplier) || 1);
            productData.coldUnitMultiplier = Math.max(1, parseInt(formData.coldUnitMultiplier) || 1);

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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                            <Input
                                label="Código de Barras"
                                name="barcode"
                                value={formData.barcode}
                                onChange={handleChange}
                                placeholder="Escaneie ou digite"
                                className="no-margin"
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
                            style={{ height: '48px', alignSelf: 'flex-end' }}
                        >
                            Gerar
                        </Button>
                    </div>
                    <Input
                        label="Nome do Produto"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        error={errors.name}
                        placeholder="Ex: Coca-Cola 2L"
                        autoFocus
                        className="no-margin"
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <CurrencyInput
                                    label="Preço (Atacado)"
                                    name="wholesalePrice"
                                    value={formData.wholesalePrice}
                                    onChange={handleChange}
                                    error={errors.wholesalePrice}
                                    placeholder="0,00"
                                    className="no-margin"
                                />
                            </div>
                            <div className="input-group no-margin" style={{ width: '80px' }}>
                                <label className="input-label">Un.</label>
                                <select
                                    name="wholesaleUnit"
                                    value={formData.wholesaleUnit}
                                    onChange={handleChange}
                                    className="input"
                                    style={{ width: '100%' }}
                                >
                                    {units.map(unit => (
                                        <option key={unit.id} value={unit.abbreviation}>{unit.abbreviation}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ width: '110px' }}>
                                <Input
                                    label="Qtd/Un."
                                    name="wholesaleUnitMultiplier"
                                    type="number"
                                    value={formData.wholesaleUnitMultiplier}
                                    onChange={handleChange}
                                    placeholder="1"
                                    className="no-margin"
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <CurrencyInput
                                label="Preço Custo (Atacado)"
                                name="cost"
                                value={formData.cost}
                                onChange={handleChange}
                                placeholder="0,00"
                                className="no-margin"
                            />
                        </div>
                        <Input
                            label="Estoque Atual"
                            name="stock"
                            type="number"
                            value={formData.stock}
                            onChange={handleChange}
                            placeholder="0"
                            className="no-margin"
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <CurrencyInput
                                    label="Preço (Mercearia)"
                                    name="coldPrice"
                                    value={formData.coldPrice}
                                    onChange={handleChange}
                                    error={errors.coldPrice}
                                    placeholder="0,00"
                                    className="no-margin"
                                />
                            </div>
                            <div className="input-group no-margin" style={{ width: '80px' }}>
                                <label className="input-label">Un.</label>
                                <select
                                    name="coldUnit"
                                    value={formData.coldUnit}
                                    onChange={handleChange}
                                    className="input"
                                    style={{ width: '100%' }}
                                >
                                    {units.map(unit => (
                                        <option key={unit.id} value={unit.abbreviation}>{unit.abbreviation}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ width: '110px' }}>
                                <Input
                                    label="Qtd/Un."
                                    name="coldUnitMultiplier"
                                    type="number"
                                    value={formData.coldUnitMultiplier}
                                    onChange={handleChange}
                                    placeholder="1"
                                    className="no-margin"
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <CurrencyInput
                                label="Preço Custo (Mercearia)"
                                name="coldCost"
                                value={formData.coldCost}
                                onChange={handleChange}
                                placeholder="0,00"
                                className="no-margin"
                            />
                        </div>
                        <Input
                            label="Estoque Mercearia"
                            name="coldStock"
                            type="number"
                            value={formData.coldStock}
                            onChange={handleChange}
                            placeholder="0"
                            className="no-margin"
                        />
                    </div>
                </div>

                <div className="input-group no-margin">
                    <label className="input-label">Categoria</label>
                    <select
                        name="categoryId"
                        value={formData.categoryId}
                        onChange={handleChange}
                        className="input"
                    >
                        <option value="">Selecione uma categoria</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                                {cat.name}
                            </option>
                        ))}
                    </select>
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
