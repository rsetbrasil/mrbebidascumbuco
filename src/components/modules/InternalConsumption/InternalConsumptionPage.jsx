import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, FileText, Clock, ArrowLeft, Printer, CreditCard, Edit, Package } from 'lucide-react';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Modal from '../../common/Modal';
import { useApp } from '../../../contexts/AppContext';
import { useAuth } from '../../../contexts/AuthContext';
import { productService, stockService, firestoreService, COLLECTIONS } from '../../../services/firestore';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { printReceipt } from '../../../utils/receiptPrinter';

const InternalConsumptionPage = () => {
    const { showNotification, currentCashRegister, settings } = useApp();
    const { user, canWrite } = useAuth();

    const [view, setView] = useState('register'); // 'register' | 'history'
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

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
                if (editingId) {
                    // Fetch old record to restore stock
                    const oldRecord = await firestoreService.getById('internalConsumptions', editingId);
                    if (oldRecord && oldRecord.items) {
                        for (const it of oldRecord.items) {
                            const prod = await firestoreService.getById(COLLECTIONS.PRODUCTS, it.productId);
                            if (prod) {
                                const payload = {};
                                if (it.isCold) {
                                    payload.coldStock = Number(prod.coldStock || 0) + Number(it.quantity);
                                } else {
                                    payload.stock = Number(prod.stock || 0) + Number(it.quantity);
                                }
                                await firestoreService.update(COLLECTIONS.PRODUCTS, prod.id, payload);
                            }
                        }
                    }
                }
                const cmv = await stockService.consumeForItems(items);
                cmvTotal = Number(cmv.cmvTotal || 0);

                // Deduct actual product stock
                for (const it of items) {
                    const prod = await firestoreService.getById(COLLECTIONS.PRODUCTS, it.productId);
                    if (prod) {
                        const payload = {};
                        if (it.isCold) {
                            payload.coldStock = Math.max(0, Number(prod.coldStock || 0) - Number(it.quantity));
                        } else {
                            payload.stock = Math.max(0, Number(prod.stock || 0) - Number(it.quantity));
                        }
                        await firestoreService.update(COLLECTIONS.PRODUCTS, prod.id, payload);
                    }
                }

                // Refresh product list in UI
                loadProducts();

            } catch (err) {
                console.error("Erro ao calcular CMV / atualizar estoque:", err);
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
                status: 'unpaid',
                updatedAt: new Date()
            };

            if (editingId) {
                await firestoreService.update('internalConsumptions', editingId, consumptionData);
                showNotification('Consumo interno atualizado com sucesso!', 'success');
            } else {
                consumptionData.createdAt = new Date();
                const newDoc = await firestoreService.create('internalConsumptions', consumptionData);
                
                // Auto print receipt for new consumptions
                printConsumption({ id: newDoc.id, ...consumptionData });
                showNotification('Consumo interno registrado com sucesso!', 'success');
            }

            setItems([]);
            setEditingId(null);
            setNoteInput('');
        } catch (error) {
            console.error('Error saving internal consumption:', error);
            showNotification('Erro ao registrar consumo', 'error');
        } finally {
            setProcessing(false);
        }
    };

    // Payment Modal State
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [recordToPay, setRecordToPay] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('money');
    const [amountReceived, setAmountReceived] = useState('');

    // Editing state
    const [editingId, setEditingId] = useState(null);

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const data = await firestoreService.query('internalConsumptions', [], 'createdAt', 'desc', 50);
            setHistory(data);
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            showNotification('Erro ao carregar histórico de consumo', 'error');
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleViewHistory = () => {
        loadHistory();
        setView('history');
    };

    const handleEdit = (record) => {
        if (record.status === 'paid') {
            showNotification('Não é possível editar um consumo já pago.', 'warning');
            return;
        }
        setItems(record.items || []);
        setNoteInput(record.notes || '');
        setEditingId(record.id);
        setView('register');
    };

    const handlePay = (record) => {
        if (!currentCashRegister) {
            showNotification('O caixa precisa estar aberto para registrar pagamentos', 'warning');
            return;
        }
        setRecordToPay(record);
        setPaymentMethod('money');
        setAmountReceived('');
        setPaymentModalOpen(true);
    };

    const formatDisplayCurrency = (val) => {
        if (!val) return '';
        const numberStr = val.toString().padStart(3, '0');
        const wholePart = numberStr.slice(0, -2);
        const decimalPart = numberStr.slice(-2);
        
        // Add thousands separators
        const formattedWholePart = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        
        return `${formattedWholePart},${decimalPart}`;
    };

    const handleAmountReceivedChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (!value) {
            setAmountReceived('');
            return;
        }
        setAmountReceived(value); // Store the raw string of digits
    };

    const confirmPayment = async () => {
        if (!recordToPay) return;
        try {
            setProcessing(true);
            
            const totalToPay = Number(recordToPay.totalCost || 0);
            let change = 0;
            let numericReceived = totalToPay;

            if (paymentMethod === 'money') {
                numericReceived = parseFloat(amountReceived) / 100;
                if (!isNaN(numericReceived) && numericReceived > totalToPay) {
                    change = numericReceived - totalToPay;
                }
            }

            // Register cash movement
            await firestoreService.create('cashMovements', {
                cashRegisterId: currentCashRegister.id,
                type: 'inflow',
                amount: totalToPay,
                description: `Pagamento de Consumo Interno #${recordToPay.id.substring(0, 6)}`,
                paymentMethod: paymentMethod,
                timestamp: new Date()
            });

            // Register change if any
            if (change > 0) {
                await firestoreService.create('cashMovements', {
                    cashRegisterId: currentCashRegister.id,
                    type: 'change',
                    amount: change,
                    description: `Troco Pag. Consumo #${recordToPay.id.substring(0, 6)}`,
                    paymentMethod: 'money',
                    timestamp: new Date()
                });
            }

            // Update consumption record
            await firestoreService.update('internalConsumptions', recordToPay.id, {
                status: 'paid',
                paymentMethod: paymentMethod,
                amountReceived: numericReceived,
                change: change,
                paidAt: new Date()
            });

            showNotification('Pagamento registrado com sucesso!', 'success');
            setPaymentModalOpen(false);
            loadHistory();
        } catch (err) {
            console.error('Error paying:', err);
            showNotification('Erro ao registrar pagamento', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const printConsumption = (record) => {
        const fakeSale = {
            id: record.id,
            receiptTitle: 'CONSUMO INTERNO',
            saleNumber: `CONS-${record.id.substring(0, 6).toUpperCase()}`,
            createdAt: record.createdAt,
            total: record.totalCost,
            discount: 0,
            paymentMethod: record.paymentMethod || '-',
            customerName: 'MR Bebidas',
            notes: record.notes || 'Sem motivo registrado',
            items: (record.items || []).map(it => ({
                productName: it.productName,
                quantity: it.quantity,
                unitPrice: it.unitCost,
                total: it.totalCost
            }))
        };
        printReceipt(fakeSale, settings);
    };

    const totalCost = items.reduce((sum, it) => sum + it.totalCost, 0);

    if (view === 'history') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Package size={14} /> {history.length} registro{history.length !== 1 ? 's' : ''}
                        </div>
                        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>Histórico de Consumo</h1>
                    </div>
                    <button
                        onClick={() => setView('register')}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                    >
                        <ArrowLeft size={16} /> Voltar
                    </button>
                </div>

                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                    {loadingHistory ? (
                        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando histórico...</div>
                    ) : history.length === 0 ? (
                        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Package size={40} style={{ opacity: 0.15, display: 'block', margin: '0 auto 10px' }} />
                            <p style={{ margin: 0 }}>Nenhum consumo registrado ainda.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        {['Data/Hora', 'Operador', 'Itens', 'Motivo/Obs', 'Status', 'Custo Total', 'Ações'].map((h, i) => (
                                            <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i >= 5 ? 'right' : 'left' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(record => (
                                        <tr key={record.id} style={{ borderBottom: '1px solid var(--color-divider)', transition: 'background 0.1s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                                            <td style={{ padding: '13px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{formatDateTime(record.createdAt)}</td>
                                            <td style={{ padding: '13px 16px', fontSize: '13px', fontWeight: 600 }}>{record.createdBy || '—'}</td>
                                            <td style={{ padding: '13px 16px' }}>
                                                {Array.isArray(record.items) ? record.items.map(it => (
                                                    <div key={it.productId} style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                                        {it.quantity}x {it.productName}
                                                    </div>
                                                )) : '—'}
                                            </td>
                                            <td style={{ padding: '13px 16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>{record.notes || '—'}</td>
                                            <td style={{ padding: '13px 16px' }}>
                                                <span style={{
                                                    padding: '3px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    background: record.status === 'paid' ? '#10b98118' : '#f59e0b18',
                                                    color: record.status === 'paid' ? '#10b981' : '#f59e0b'
                                                }}>
                                                    {record.status === 'paid' ? 'Pago' : 'Pendente'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '13px 16px', textAlign: 'right', fontWeight: 700, fontSize: '14px' }}>{formatCurrency(record.totalCost || 0)}</td>
                                            <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                    {record.status !== 'paid' && (
                                                        <>
                                                            <button onClick={() => handlePay(record)} title="Pagar"
                                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: 'none', background: 'var(--gradient-primary)', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
                                                                <CreditCard size={13} /> Pagar
                                                            </button>
                                                            <button onClick={() => handleEdit(record)} title="Editar"
                                                                style={{ padding: '7px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer' }}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                                <Edit size={15} />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button onClick={() => printConsumption(record)} title="Imprimir"
                                                        style={{ padding: '7px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                        <Printer size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Payment Modal */}
                <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Pagar Consumo Interno" size="sm">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <p>Total a pagar: <strong>{formatCurrency(recordToPay?.totalCost || 0)}</strong></p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Forma de Pagamento</label>
                            <select 
                                value={paymentMethod} 
                                onChange={(e) => {
                                    setPaymentMethod(e.target.value);
                                    if (e.target.value !== 'money') setAmountReceived('');
                                }}
                                style={{
                                    padding: 'var(--spacing-md)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-bg-primary)',
                                    color: 'var(--color-text-primary)'
                                }}
                            >
                                <option value="money">Dinheiro</option>
                                <option value="credit">Cartão de Crédito</option>
                                <option value="debit">Cartão de Débito</option>
                                <option value="pix">PIX</option>
                            </select>
                        </div>
                        
                        {paymentMethod === 'money' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                <Input
                                    label="Valor Recebido (R$)"
                                    type="text"
                                    value={amountReceived ? formatDisplayCurrency(amountReceived) : ''}
                                    onChange={handleAmountReceivedChange}
                                    placeholder="Ex: 50,00"
                                    onKeyDown={(e) => { if (e.key === 'Enter') confirmPayment(); }}
                                />
                                {(() => {
                                    const received = parseFloat(amountReceived) / 100;
                                    const total = recordToPay?.totalCost || 0;
                                    if (!isNaN(received) && received > total) {
                                        return (
                                            <div style={{ 
                                                padding: 'var(--spacing-sm)', 
                                                background: 'var(--color-bg-hover)', 
                                                borderRadius: 'var(--radius-md)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <span style={{ fontWeight: 600 }}>Troco:</span>
                                                <span style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: 'var(--font-size-lg)' }}>
                                                    {formatCurrency(received - total)}
                                                </span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        )}

                        <Button variant="primary" onClick={confirmPayment} disabled={processing} className="w-full justify-center">
                            {processing ? 'Processando...' : 'Confirmar Pagamento'}
                        </Button>
                    </div>
                </Modal>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Package size={14} /> {editingId ? 'Editando registro' : 'Baixa de estoque para consumo interno'}
                    </div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                        {editingId ? 'Editar Consumo' : 'Consumo Interno'}
                    </h1>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {editingId && (
                        <button
                            onClick={() => { setItems([]); setEditingId(null); setNoteInput(''); }}
                            style={{ padding: '9px 18px', borderRadius: '10px', border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                        >
                            Cancelar Edição
                        </button>
                    )}
                    <button
                        onClick={handleViewHistory}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                    >
                        <Clock size={15} /> Ver Histórico
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px', alignItems: 'start' }}>
                {/* Left Column - Products */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Search Card */}
                    <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Search size={15} color="var(--color-text-muted)" />
                            <span style={{ fontWeight: 700, fontSize: '14px' }}>Buscar Produtos</span>
                        </div>
                        <div style={{ padding: '14px 16px' }}>
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
                                            padding: '12px 16px',
                                            borderBottom: '1px solid var(--color-divider)',
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
                                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{product.name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                                Estoque: {product.stock} un
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                                            {formatCurrency(product.cost)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Items Card */}
                    <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShoppingCart size={15} color="var(--color-text-muted)" />
                            <span style={{ fontWeight: 700, fontSize: '14px' }}>Itens do Consumo</span>
                        </div>
                        {items.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                Nenhum item adicionado
                            </div>
                        ) : (
                            items.map((item) => (
                                <div key={item.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.productName}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                            {formatCurrency(item.unitCost)}/un {item.isCold ? '· Gelado' : ''}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-bg-primary)', padding: '4px 6px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                            <button onClick={() => updateQuantity(item.id, -1)} style={{ padding: '2px 4px', background: 'transparent', border: 'none', color: 'var(--color-text-primary)', cursor: 'pointer' }}><Minus size={14} /></button>
                                            <span style={{ minWidth: '28px', textAlign: 'center', fontWeight: 700, fontSize: '14px' }}>{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)} style={{ padding: '2px 4px', background: 'transparent', border: 'none', color: 'var(--color-text-primary)', cursor: 'pointer' }}><Plus size={14} /></button>
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '14px', minWidth: '80px', textAlign: 'right' }}>
                                            {formatCurrency(item.totalCost)}
                                        </div>
                                        <button onClick={() => handleRemoveItem(item.id)} style={{ padding: '6px', color: 'var(--color-danger)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Column - Summary */}
                <div style={{ position: 'sticky', top: '80px' }}>
                    <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={15} color="var(--color-text-muted)" />
                            <span style={{ fontWeight: 700, fontSize: '14px' }}>Resumo do Custo</span>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '16px', background: 'var(--color-bg-primary)', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custo Total</span>
                                <span style={{ fontWeight: 800, fontSize: '22px', color: 'var(--color-danger)', letterSpacing: '-0.5px' }}>{formatCurrency(totalCost)}</span>
                            </div>
                            <button
                                onClick={handleFinalize}
                                disabled={processing || items.length === 0}
                                style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: processing || items.length === 0 ? 'var(--color-bg-hover)' : 'var(--gradient-primary)', color: processing || items.length === 0 ? 'var(--color-text-muted)' : '#fff', fontWeight: 700, fontSize: '15px', cursor: processing || items.length === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
                            >
                                {processing ? 'Processando...' : editingId ? 'Atualizar Consumo' : 'Registrar Consumo'}
                            </button>
                        </div>
                    </div>
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
