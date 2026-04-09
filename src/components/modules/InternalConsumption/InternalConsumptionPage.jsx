import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, FileText } from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Modal from '../../common/Modal';
import { useApp } from '../../../contexts/AppContext';
import { useAuth } from '../../../contexts/AuthContext';
import { productService, stockService, firestoreService, COLLECTIONS } from '../../../services/firestore';
import { formatCurrency } from '../../../utils/formatters';

const InternalConsumptionPage = () => {
    const { showNotification, currentCashRegister } = useApp();
    const { user, canWrite } = useAuth();

    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [processing, setProcessing] = useState(false);

    // Cart State
    const [items, setItems] = useState([]);

    // Quantity Modal State
    const [quantityModalOpen, setQuantityModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantityInput, setQuantityInput] = useState('1');
    const [itemPriceType, setItemPriceType] = useState('wholesale');
    const [quantityStep, setQuantityStep] = useState('quantity');

    // Note Modal
    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [noteInput, setNoteInput] = useState('');

    const searchInputRef = useRef(null);
    const quantityInputRef = useRef(null);

    useEffect(() => {
        loadProducts();
    }, []);

    const searchDebounceRef = useRef(null);
    useEffect(() => {
        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }
        searchDebounceRef.current = setTimeout(() => {
            const term = searchTerm.trim().toLowerCase();
            if (term) {
                const filtered = products
                    .filter(p =>
                        (p.name || '').toLowerCase().includes(term) ||
                        String(p.barcode || '').includes(term)
                    )
                    .slice(0, 50);
                setFilteredProducts(filtered);
            } else {
                setFilteredProducts([]);
            }
            setSelectedIndex(-1);
        }, 120);
        return () => clearTimeout(searchDebounceRef.current);
    }, [searchTerm, products]);

    const loadProducts = async () => {
        try {
            const data = await productService.getAll();
            setProducts(data);
        } catch (error) {
            console.error('Error loading products:', error);
            showNotification('Erro ao carregar produtos', 'error');
        }
    };

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setQuantityInput('1');
        setItemPriceType('wholesale');
        setQuantityStep('quantity');
        setQuantityModalOpen(true);
        setTimeout(() => quantityInputRef.current?.focus(), 100);
    };

    const handleConfirmQuantity = () => {
        const qty = parseFloat(String(quantityInput).replace(',', '.'));
        if (isNaN(qty) || qty <= 0) {
            showNotification('Quantidade inválida', 'warning');
            return;
        }

        const unitCost = itemPriceType === 'cold' ? (selectedProduct.coldCost || selectedProduct.cost || 0) : (selectedProduct.cost || 0);

        const newItem = {
            id: Math.random().toString(36).substr(2, 9),
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            quantity: qty,
            unitCost: unitCost,
            isCold: itemPriceType === 'cold',
            totalCost: unitCost * qty
        };

        setItems(prev => [...prev, newItem]);
        setQuantityModalOpen(false);
        setSearchTerm('');
        setTimeout(() => searchInputRef.current?.focus(), 100);
    };

    const handleRemoveItem = (id) => {
        setItems(prev => prev.filter(it => it.id !== id));
    };

    const updateQuantity = (id, delta) => {
        setItems(prev => prev.map(it => {
            if (it.id === id) {
                const newQty = Math.max(1, it.quantity + delta);
                return { ...it, quantity: newQty, totalCost: it.unitCost * newQty };
            }
            return it;
        }));
    };

    const handleFinalize = async () => {
        if (items.length === 0) {
            showNotification('Adicione produtos para o consumo interno', 'warning');
            return;
        }
        if (!currentCashRegister) {
            showNotification('O caixa precisa estar aberto para registrar consumos', 'warning');
            return;
        }
        setNoteInput('');
        setNoteModalOpen(true);
    };

    const confirmFinalize = async () => {
        try {
            setProcessing(true);
            setNoteModalOpen(false);

            // Process CMV and Deduct Stock
            let cmvTotal = 0;
            try {
                const cmv = await stockService.consumeForItems(items);
                cmvTotal = Number(cmv.cmvTotal || 0);
            } catch (err) {
                console.error("Erro ao calcular CMV:", err);
            }

            const consumptionData = {
                cashRegisterId: currentCashRegister.id,
                items: items.map(it => ({
                    productId: it.productId,
                    productName: it.productName,
                    quantity: it.quantity,
                    unitCost: it.unitCost,
                    isCold: it.isCold,
                    totalCost: it.totalCost
                })),
                totalCost: cmvTotal,
                notes: noteInput,
                createdBy: user?.name || 'Operador',
                createdAt: new Date()
            };

            await firestoreService.create('internalConsumptions', consumptionData);

            // Optionally register as an expense in cash movements if we want it to reflect in cash balance
            // Not doing it unless requested, as internal consumption is usually just a stock reduction

            setItems([]);
            showNotification('Consumo interno registrado com sucesso!', 'success');
        } catch (error) {
            console.error('Error saving internal consumption:', error);
            showNotification('Erro ao registrar consumo', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const totalCost = items.reduce((sum, it) => sum + it.totalCost, 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)', height: '100%' }}>
            <div>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-xs)' }}>Consumo Interno</h1>
                <p style={{ color: 'var(--color-text-secondary)' }}>Registre a retirada de produtos para consumo interno (baixa de estoque).</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--spacing-lg)', alignItems: 'start' }}>
                {/* Left Column - Products */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <Card title="Buscar Produtos" icon={Search}>
                        <div style={{ padding: 'var(--spacing-md)' }}>
                            <Input
                                ref={searchInputRef}
                                placeholder="Buscar produto..."
                                icon={Search}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {filteredProducts.length > 0 && (
                            <div style={{ borderTop: '1px solid var(--color-border)' }}>
                                {filteredProducts.map((product, idx) => (
                                    <div
                                        key={product.id}
                                        onClick={() => handleProductSelect(product)}
                                        style={{
                                            padding: 'var(--spacing-md)',
                                            borderBottom: '1px solid var(--color-border)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            background: selectedIndex === idx ? 'var(--color-bg-hover)' : 'transparent',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = selectedIndex === idx ? 'var(--color-bg-hover)' : 'transparent'}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{product.name}</div>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                                Estoque: {product.stock} un
                                            </div>
                                        </div>
                                        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                            Custo: {formatCurrency(product.cost)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card title="Itens do Consumo" icon={ShoppingCart}>
                        {items.length === 0 ? (
                            <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                Nenhum item adicionado
                            </div>
                        ) : (
                            <div>
                                {items.map((item) => (
                                    <div key={item.id} style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{item.productName}</div>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                                Custo Unit: {formatCurrency(item.unitCost)} {item.isCold ? '(Gelado)' : ''}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                                                <button onClick={() => updateQuantity(item.id, -1)} style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--color-text-primary)', cursor: 'pointer' }}><Minus size={16} /></button>
                                                <span style={{ minWidth: '30px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)} style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--color-text-primary)', cursor: 'pointer' }}><Plus size={16} /></button>
                                            </div>
                                            <div style={{ fontWeight: 600, minWidth: '80px', textAlign: 'right' }}>
                                                {formatCurrency(item.totalCost)}
                                            </div>
                                            <button onClick={() => handleRemoveItem(item.id)} style={{ padding: '8px', color: 'var(--color-danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Right Column - Summary */}
                <div style={{ position: 'sticky', top: '90px' }}>
                    <Card title="Resumo do Custo" icon={FileText}>
                        <div style={{ padding: 'var(--spacing-md)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                                <span style={{ color: 'var(--color-text-secondary)' }}>Custo Total</span>
                                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xl)', color: 'var(--color-danger)' }}>{formatCurrency(totalCost)}</span>
                            </div>

                            <Button
                                variant="primary"
                                size="lg"
                                className="w-full justify-center mt-4"
                                onClick={handleFinalize}
                                disabled={processing || items.length === 0}
                            >
                                Registrar Consumo
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Quantity Modal */}
            <Modal isOpen={quantityModalOpen} onClose={() => setQuantityModalOpen(false)} title="Adicionar Item" size="sm">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)' }}>{selectedProduct?.name}</div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)' }}>
                        <button
                            onClick={() => setItemPriceType('wholesale')}
                            style={{
                                padding: 'var(--spacing-md)',
                                borderRadius: 'var(--radius-md)',
                                border: itemPriceType === 'wholesale' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                background: itemPriceType === 'wholesale' ? 'var(--color-primary-light)' : 'var(--color-bg-secondary)',
                                color: 'var(--color-text-primary)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Atacado</span>
                            <span style={{ fontWeight: 700 }}>{formatCurrency(selectedProduct?.cost || 0)}</span>
                        </button>
                        <button
                            onClick={() => setItemPriceType('cold')}
                            style={{
                                padding: 'var(--spacing-md)',
                                borderRadius: 'var(--radius-md)',
                                border: itemPriceType === 'cold' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                background: itemPriceType === 'cold' ? 'var(--color-primary-light)' : 'var(--color-bg-secondary)',
                                color: 'var(--color-text-primary)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Gelado</span>
                            <span style={{ fontWeight: 700 }}>{formatCurrency(selectedProduct?.coldCost || selectedProduct?.cost || 0)}</span>
                        </button>
                    </div>

                    <Input
                        ref={quantityInputRef}
                        label="Quantidade"
                        type="number"
                        step="0.01"
                        value={quantityInput}
                        onChange={(e) => setQuantityInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmQuantity(); }}
                    />

                    <Button variant="primary" onClick={handleConfirmQuantity} className="w-full justify-center">
                        Confirmar
                    </Button>
                </div>
            </Modal>

            {/* Note Modal */}
            <Modal isOpen={noteModalOpen} onClose={() => setNoteModalOpen(false)} title="Detalhes do Consumo" size="sm">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <Input
                        label="Motivo/Observação (opcional)"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Ex: Lanche da equipe, degustação, quebra..."
                        onKeyDown={(e) => { if (e.key === 'Enter') confirmFinalize(); }}
                    />
                    <Button variant="primary" onClick={confirmFinalize} className="w-full justify-center">
                        Concluir Registro
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default InternalConsumptionPage;
