import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, FileText, Clock, ArrowLeft, Printer, CreditCard, Edit } from 'lucide-react';
import Card from '../../common/Card';
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-xs)' }}>Histórico de Consumo Interno</h1>
                        <p style={{ color: 'var(--color-text-secondary)' }}>Últimos registros de retirada de estoque para consumo.</p>
                    </div>
                    <Button variant="secondary" onClick={() => setView('register')} icon={<ArrowLeft size={18} />}>
                        Voltar para Registro
                    </Button>
                </div>

                <Card>
                    {loadingHistory ? (
                        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando histórico...</div>
                    ) : history.length === 0 ? (
                        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhum consumo registrado ainda.</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                                        <th style={{ padding: 'var(--spacing-sm)' }}>Data/Hora</th>
                                        <th style={{ padding: 'var(--spacing-sm)' }}>Operador</th>
                                        <th style={{ padding: 'var(--spacing-sm)' }}>Itens</th>
                                        <th style={{ padding: 'var(--spacing-sm)' }}>Motivo/Obs</th>
                                        <th style={{ padding: 'var(--spacing-sm)' }}>Status</th>
                                        <th style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>Custo Total</th>
                                        <th style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(record => (
                                        <tr key={record.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: 'var(--spacing-sm)' }}>{formatDateTime(record.createdAt)}</td>
                                            <td style={{ padding: 'var(--spacing-sm)' }}>{record.createdBy || '-'}</td>
                                            <td style={{ padding: 'var(--spacing-sm)' }}>
                                                {Array.isArray(record.items) ? record.items.map(it => (
                                                    <div key={it.productId} style={{ fontSize: 'var(--font-size-xs)' }}>
                                                        {it.quantity}x {it.productName}
                                                    </div>
                                                )) : '-'}
                                            </td>
                                            <td style={{ padding: 'var(--spacing-sm)', color: 'var(--color-text-secondary)' }}>{record.notes || '-'}</td>
                                            <td style={{ padding: 'var(--spacing-sm)' }}>
                                                <span style={{ 
                                                    padding: '2px 8px', 
                                                    borderRadius: '12px', 
                                                    fontSize: 'var(--font-size-xs)',
                                                    fontWeight: 600,
                                                    background: record.status === 'paid' ? 'var(--color-success)' : 'var(--color-warning)',
                                                    color: 'white'
                                                }}>
                                                    {record.status === 'paid' ? 'Pago' : 'Pendente'}
                                                </span>
                                            </td>
                                            <td style={{ padding: 'var(--spacing-sm)', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(record.totalCost || 0)}</td>
                                            <td style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    {record.status !== 'paid' && (
                                                        <>
                                                            <Button variant="primary" size="sm" onClick={() => handlePay(record)} title="Pagar">
                                                                <CreditCard size={14} /> Pagar
                                                            </Button>
                                                            <Button variant="secondary" size="sm" onClick={() => handleEdit(record)} title="Editar">
                                                                <Edit size={14} />
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button variant="secondary" size="sm" onClick={() => printConsumption(record)} title="Imprimir Comprovante">
                                                        <Printer size={14} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-xs)' }}>
                        {editingId ? 'Editando Consumo Interno' : 'Consumo Interno'}
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                        {editingId ? 'Altere os itens e salve para atualizar o registro.' : 'Registre a retirada de produtos para consumo interno (baixa de estoque).'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                    {editingId && (
                        <Button variant="danger" onClick={() => { setItems([]); setEditingId(null); setNoteInput(''); }}>
                            Cancelar Edição
                        </Button>
                    )}
                    <Button variant="secondary" onClick={handleViewHistory} icon={<Clock size={18} />}>
                        Ver Histórico
                    </Button>
                </div>
            </div>

            <div style={{ display: 'flex', gridTemplateColumns: '1fr 380px', gap: 'var(--spacing-lg)', alignItems: 'start' }} className="grid md:grid-cols-[1fr_380px]">
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
                                {editingId ? 'Atualizar Consumo' : 'Registrar Consumo'}
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
