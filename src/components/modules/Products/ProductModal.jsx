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
        wholesalePrice2: '',
        coldPrice: '',
        coldPrice2: '',
        retailPrice: '',
        retailPrice2: '',
        cost: '',
        coldCost: '',
        retailCost: '',
        stock: '',
        coldStock: '',
        retailStock: '',
        categoryId: '',
        wholesaleUnit: 'UN',
        coldUnit: 'UN',
        retailUnit: 'UN',
        wholesaleUnitMultiplier: 1,
        coldUnitMultiplier: 1,
        retailUnitMultiplier: 1,
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
                wholesalePrice2: product.wholesalePrice2 ?? '',
                coldPrice: product.coldPrice === null ? '' : (product.coldPrice ?? ''),
                coldPrice2: product.coldPrice2 ?? '',
                retailPrice: product.retailPrice === null ? '' : (product.retailPrice ?? ''),
                retailPrice2: product.retailPrice2 ?? '',
                cost: product.cost || '',
                coldCost: product.coldCost || '',
                retailCost: product.retailCost || '',
                stock: product.stock || '',
                coldStock: product.coldStock || '',
                retailStock: product.retailStock || '',
                categoryId: product.categoryId || '',
                wholesaleUnit: product.wholesaleUnit || product.unitOfMeasure || 'UN',
                coldUnit: product.coldUnit || product.unitOfMeasure || 'UN',
                retailUnit: product.retailUnit || 'UN',
                wholesaleUnitMultiplier: product.wholesaleUnitMultiplier || 1,
                coldUnitMultiplier: product.coldUnitMultiplier || 1,
                retailUnitMultiplier: product.retailUnitMultiplier || 1,
                active: product.active !== undefined ? product.active : true
            });
        } else {
            setFormData({
                name: '',
                barcode: '',
                wholesalePrice: '',
                wholesalePrice2: '',
                coldPrice: '',
                coldPrice2: '',
                retailPrice: '',
                retailPrice2: '',
                cost: '',
                coldCost: '',
                retailCost: '',
                stock: '',
                coldStock: '',
                retailStock: '',
                categoryId: '',
                wholesaleUnit: 'UN',
                coldUnit: 'UN',
                retailUnit: 'UN',
                wholesaleUnitMultiplier: 1,
                coldUnitMultiplier: 1,
                retailUnitMultiplier: 1,
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
        const retailOk = formData.retailPrice !== '' && Number(formData.retailPrice) > 0;
        if (!wholesaleOk && !coldOk && !retailOk) {
            const msg = 'Informe o preço do Atacado, Mercearia ou Varejo';
            newErrors.wholesalePrice = msg;
            newErrors.coldPrice = msg;
            newErrors.retailPrice = msg;
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
            const wholesalePrice2 = normalizeMoney(formData.wholesalePrice2);
            const coldPrice = normalizeMoney(formData.coldPrice);
            const coldPrice2 = normalizeMoney(formData.coldPrice2);
            const retailPrice = normalizeMoney(formData.retailPrice);
            const retailPrice2 = normalizeMoney(formData.retailPrice2);
            const cost = normalizeMoney(formData.cost);
            const coldCost = normalizeMoney(formData.coldCost);
            const retailCost = normalizeMoney(formData.retailCost);
            const basePrice = wholesalePrice ?? coldPrice ?? retailPrice ?? 0;

            const productData = {
                ...formData,
                price: basePrice,
                wholesalePrice,
                wholesalePrice2,
                coldPrice,
                coldPrice2,
                retailPrice,
                retailPrice2,
                cost: cost ?? 0,
                coldCost: coldCost ?? 0,
                retailCost: retailCost ?? 0,
                stock: parseInt(formData.stock) || 0,
                coldStock: parseInt(formData.coldStock) || 0,
                retailStock: parseInt(formData.retailStock) || 0
            };
            productData.wholesaleUnitMultiplier = Math.max(1, parseInt(formData.wholesaleUnitMultiplier) || 1);
            productData.coldUnitMultiplier = Math.max(1, parseInt(formData.coldUnitMultiplier) || 1);
            productData.retailUnitMultiplier = Math.max(1, parseInt(formData.retailUnitMultiplier) || 1);

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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    {/* ── ATACADO ── */}
                    <div style={{ border: '1px solid #22c55e55', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ background: '#22c55e18', borderBottom: '1px solid #22c55e44', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: '13px', color: '#16a34a', letterSpacing: '0.03em' }}>ATACADO</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                                <div style={{ flex: 1 }}>
                                    <CurrencyInput label="Preço 1" name="wholesalePrice" value={formData.wholesalePrice} onChange={handleChange} error={errors.wholesalePrice} placeholder="0,00" className="no-margin" />
                                </div>
                                <div className="input-group no-margin" style={{ width: '64px' }}>
                                    <label className="input-label">Un.</label>
                                    <select name="wholesaleUnit" value={formData.wholesaleUnit} onChange={handleChange} className="input" style={{ width: '100%' }}>
                                        {units.map(u => <option key={u.id} value={u.abbreviation}>{u.abbreviation}</option>)}
                                    </select>
                                </div>
                                <div style={{ width: '64px' }}>
                                    <Input label="Qtd/Un." name="wholesaleUnitMultiplier" type="number" value={formData.wholesaleUnitMultiplier} onChange={handleChange} placeholder="1" className="no-margin" />
                                </div>
                            </div>
                            <CurrencyInput label="Preço 2" name="wholesalePrice2" value={formData.wholesalePrice2} onChange={handleChange} placeholder="0,00" className="no-margin" />
                            <div style={{ height: '1px', background: '#22c55e22', margin: '0 -12px' }} />
                            <CurrencyInput label="Custo" name="cost" value={formData.cost} onChange={handleChange} placeholder="0,00" className="no-margin" />
                            <Input label="Estoque" name="stock" type="number" value={formData.stock} onChange={handleChange} placeholder="0" className="no-margin" />
                        </div>
                    </div>

                    {/* ── MERCEARIA ── */}
                    <div style={{ border: '1px solid #3b82f655', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ background: '#3b82f618', borderBottom: '1px solid #3b82f644', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: '13px', color: '#2563eb', letterSpacing: '0.03em' }}>MERCEARIA</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                                <div style={{ flex: 1 }}>
                                    <CurrencyInput label="Preço 1" name="coldPrice" value={formData.coldPrice} onChange={handleChange} error={errors.coldPrice} placeholder="0,00" className="no-margin" />
                                </div>
                                <div className="input-group no-margin" style={{ width: '64px' }}>
                                    <label className="input-label">Un.</label>
                                    <select name="coldUnit" value={formData.coldUnit} onChange={handleChange} className="input" style={{ width: '100%' }}>
                                        {units.map(u => <option key={u.id} value={u.abbreviation}>{u.abbreviation}</option>)}
                                    </select>
                                </div>
                                <div style={{ width: '64px' }}>
                                    <Input label="Qtd/Un." name="coldUnitMultiplier" type="number" value={formData.coldUnitMultiplier} onChange={handleChange} placeholder="1" className="no-margin" />
                                </div>
                            </div>
                            <CurrencyInput label="Preço 2" name="coldPrice2" value={formData.coldPrice2} onChange={handleChange} placeholder="0,00" className="no-margin" />
                            <div style={{ height: '1px', background: '#3b82f622', margin: '0 -12px' }} />
                            <CurrencyInput label="Custo" name="coldCost" value={formData.coldCost} onChange={handleChange} placeholder="0,00" className="no-margin" />
                            <Input label="Estoque" name="coldStock" type="number" value={formData.coldStock} onChange={handleChange} placeholder="0" className="no-margin" />
                        </div>
                    </div>

                    {/* ── VAREJO ── */}
                    <div style={{ border: '1px solid #f59e0b55', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ background: '#f59e0b18', borderBottom: '1px solid #f59e0b44', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: '13px', color: '#d97706', letterSpacing: '0.03em' }}>VAREJO</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                                <div style={{ flex: 1 }}>
                                    <CurrencyInput label="Preço 1" name="retailPrice" value={formData.retailPrice} onChange={handleChange} error={errors.retailPrice} placeholder="0,00" className="no-margin" />
                                </div>
                                <div className="input-group no-margin" style={{ width: '64px' }}>
                                    <label className="input-label">Un.</label>
                                    <select name="retailUnit" value={formData.retailUnit} onChange={handleChange} className="input" style={{ width: '100%' }}>
                                        {units.map(u => <option key={u.id} value={u.abbreviation}>{u.abbreviation}</option>)}
                                    </select>
                                </div>
                                <div style={{ width: '64px' }}>
                                    <Input label="Qtd/Un." name="retailUnitMultiplier" type="number" value={formData.retailUnitMultiplier} onChange={handleChange} placeholder="1" className="no-margin" />
                                </div>
                            </div>
                            <CurrencyInput label="Preço 2" name="retailPrice2" value={formData.retailPrice2} onChange={handleChange} placeholder="0,00" className="no-margin" />
                            <div style={{ height: '1px', background: '#f59e0b22', margin: '0 -12px' }} />
                            <CurrencyInput label="Custo" name="retailCost" value={formData.retailCost} onChange={handleChange} placeholder="0,00" className="no-margin" />
                            <Input label="Estoque" name="retailStock" type="number" value={formData.retailStock} onChange={handleChange} placeholder="0" className="no-margin" />
                        </div>
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
