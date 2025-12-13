import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, User, FileText, Printer, Save, X } from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import CurrencyInput from '../../common/CurrencyInput';
import Modal from '../../common/Modal';
import { useCart } from '../../../contexts/CartContext';
import { useApp } from '../../../contexts/AppContext';
import { useAuth } from '../../../contexts/AuthContext';
import { productService, salesService, presalesService, customerService } from '../../../services/firestore';
import { formatCurrency, generateSaleNumber } from '../../../utils/formatters';
import { printReceipt } from '../../../utils/receiptPrinter';
import { cashRegisterService, firestoreService, COLLECTIONS } from '../../../services/firestore';

const SalesPage = () => {
    const {
        items,
        addItem,
        removeItem,
        updateQuantity,
        updateItemDiscount,
        calculateTotals,
        clearCart,
        customer,
        setCustomer,
        priceType,
        setPriceType,
        getCartData,
        presaleId,
        editingSale
    } = useCart();

    const { showNotification, currentCashRegister, settings } = useApp();
    const { user } = useAuth();

    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [processing, setProcessing] = useState(false);

    // Payment Modal State
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [payments, setPayments] = useState([]);



    // Quantity Modal State
    const [quantityModalOpen, setQuantityModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantityInput, setQuantityInput] = useState('1');
    const [itemPriceType, setItemPriceType] = useState('wholesale');
    const [priceInput, setPriceInput] = useState('');
    const [quantityStep, setQuantityStep] = useState('quantity');

    // Customer Selection Modal
    const [customerSelectionOpen, setCustomerSelectionOpen] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');

    // New Customer Modal
    const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);

    // Presale Modal
    const [presaleModalOpen, setPresaleModalOpen] = useState(false);
    const [presaleCustomerName, setPresaleCustomerName] = useState('');

    const searchInputRef = useRef(null);
    const quantityInputRef = useRef(null);
    const wholesaleBtnRef = useRef(null);
    const coldBtnRef = useRef(null);
    const priceInputRef = useRef(null);

    const isManager = user?.role === 'admin' || user?.role === 'manager';
    const totals = calculateTotals();
    const isEditingSale = !!editingSale;

    // Auto-fill payment amount when modal opens or payments change
    useEffect(() => {
        if (paymentModalOpen) {
            const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
            const targetTotal = isEditingSale ? Math.max(0, totals.total - (editingSale?.originalTotal || 0)) : totals.total;
            const remaining = targetTotal - totalPaid;
            if (remaining > 0) {
                setPaymentAmount(remaining);
            } else {
                setPaymentAmount('');
            }
        }
    }, [paymentModalOpen, payments, totals.total, isEditingSale, editingSale]);

    useEffect(() => {
        loadProducts();
        loadCustomers();
    }, []);

    useEffect(() => {
        return () => {};
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
                        (p._nameLower || (p.name || '').toLowerCase()).includes(term) ||
                        (p._barcodeStr || String(p.barcode || '')).includes(searchTerm) ||
                        (p._codeStr || '').includes(searchTerm) ||
                        (Array.isArray(p.units) && p.units.some(u => String(u.barcode || '').includes(searchTerm)))
                    )
                    .slice(0, 200);
                setFilteredProducts(filtered);
            } else {
                setFilteredProducts([]);
            }
            setSelectedIndex(-1);
        }, 120);
        return () => {
            if (searchDebounceRef.current) {
                clearTimeout(searchDebounceRef.current);
            }
        };
    }, [searchTerm, products]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!paymentModalOpen && !presaleModalOpen && !quantityModalOpen && !customerSelectionOpen && !newCustomerModalOpen) {
                if (e.key === 'F2') {
                    e.preventDefault();
                    handleCheckout();
                } else if (e.key === 'F3') {
                    e.preventDefault();
                    handleSavePresale();
                } else if (e.key === 'F4') {
                    e.preventDefault();
                    clearCart();
                } else if (e.key === 'F5') {
                    e.preventDefault();
                    searchInputRef.current?.focus();
                }
            } else if (paymentModalOpen) {
                if (e.key === 'F6') {
                    e.preventDefault();
                    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
                    if (!processing && payments.length > 0 && totalPaid >= totals.total) {
                        handleFinalizeSale();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [items, paymentModalOpen, presaleModalOpen, quantityModalOpen, customerSelectionOpen, newCustomerModalOpen, payments, processing, totals]);

    const loadProducts = async () => {
        try {
            const data = await productService.getAll();
            const normalized = data
                .filter(p => p.active !== false)
                .map(p => ({
                    ...p,
                    _nameLower: (p.name || '').toLowerCase(),
                    _barcodeStr: String(p.barcode || ''),
                    _codeStr: String(p.code || '')
                }));
            setProducts(normalized);
        } catch (error) {
            console.error('Error loading products:', error);
            showNotification('Erro ao carregar produtos', 'error');
        }
    };

    const loadCustomers = async () => {
        try {
            const data = await customerService.getAll();
            setCustomers(data);
        } catch (error) {
            console.error('Error loading customers:', error);
        }
    };

    const handleSearchKeyDown = async (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (filteredProducts.length > 0) {
                setSelectedIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (filteredProducts.length > 0) {
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();

            if (selectedIndex >= 0 && selectedIndex < filteredProducts.length) {
                handleProductSelect(filteredProducts[selectedIndex]);
            } else if (searchTerm) {
                // Check for exact barcode match (product or unit)
                const exactProduct = products.find(p =>
                    p.barcode === searchTerm ||
                    String(p.code || '') === searchTerm
                );

                if (exactProduct) {
                    handleProductSelect(exactProduct);
                    setSearchTerm('');
                    setFilteredProducts([]);
                } else {
                    // Check unit barcodes
                    let foundUnit = null;
                    let foundProduct = null;

                    for (const p of products) {
                        if (p.units && p.units.length > 0) {
                            const unit = p.units.find(u => u.barcode === searchTerm);
                            if (unit) {
                                foundProduct = p;
                                foundUnit = unit;
                                break;
                            }
                        }
                    }

                    if (foundProduct && foundUnit) {
                        addToCart(foundProduct, foundUnit);
                        setSearchTerm('');
                        setFilteredProducts([]);
                    }
                }
            }
        }
    };

    const handleProductSelect = (product) => {
        const wholesaleAvailable = Math.max(0, Number(product.stock || 0) - Number(product.reservedStock || 0));
        const coldAvailable = Math.max(0, Number(product.coldStock || 0) - Number(product.reservedColdStock || 0));
        if (wholesaleAvailable <= 0 && coldAvailable <= 0) {
            showNotification('Produto sem estoque disponível', 'warning');
            return;
        }

        setSelectedProduct(product);
        setQuantityInput('1');
        setItemPriceType(priceType === 'cold' ? 'cold' : 'wholesale');
        setQuantityStep('quantity');
        const defaultPrice = (priceType === 'cold')
            ? (product.coldPrice || product.price)
            : (product.wholesalePrice || product.price);
        setPriceInput(defaultPrice);
        setQuantityModalOpen(true);
        setSearchTerm('');
        setFilteredProducts([]);
        setSelectedIndex(-1);

        // Focus quantity input after a short delay to allow modal to open
        setTimeout(() => {
            if (quantityInputRef.current) {
                quantityInputRef.current.focus();
                quantityInputRef.current.select();
            }
        }, 100);
    };

    useEffect(() => {
        if (quantityModalOpen) {
            if (quantityStep === 'priceType') {
                setTimeout(() => {
                    wholesaleBtnRef.current?.focus();
                }, 0);
            } else if (quantityStep === 'price') {
                setTimeout(() => {
                    priceInputRef.current?.focus();
                }, 0);
            }
        }
    }, [quantityModalOpen, quantityStep]);

    useEffect(() => {
        if (selectedProduct && quantityModalOpen) {
            const defaultPrice = itemPriceType === 'cold'
                ? (selectedProduct.coldPrice || selectedProduct.price)
                : (selectedProduct.wholesalePrice || selectedProduct.price);
            setPriceInput(defaultPrice);
        }
    }, [itemPriceType, selectedProduct, quantityModalOpen]);

    const addToCart = (product, unit = null) => {
        // Check stock
        const currentItem = items.find(item => item.id === product.id && ((!item.unit && !unit) || (item.unit && unit && item.unit.name === unit.name)));
        const currentQty = currentItem ? currentItem.quantity : 0;
        const deduction = unit ? unit.multiplier : 1;

        // Calculate total stock needed
        const allCartItemsForProduct = items.filter(item => item.id === product.id);
        const totalStockUsed = allCartItemsForProduct.reduce((acc, item) => {
            const itemDeduction = item.unit ? item.unit.multiplier : 1;
            return acc + (item.quantity * itemDeduction);
        }, 0);

        // Determine which stock to check based on priceType
        const isCold = priceType === 'cold';
        const baseStock = isCold ? Number(product.coldStock || 0) : Number(product.stock || 0);
        const reserved = isCold ? Number(product.reservedColdStock || 0) : Number(product.reservedStock || 0);
        const availableStock = Math.max(0, baseStock - reserved);
        const stockType = isCold ? 'mercearia' : 'natural';

        if (totalStockUsed + deduction > availableStock) {
            showNotification(`Estoque ${stockType} insuficiente. Disponível: ${availableStock} (Reservado: ${reserved})`, 'warning');
            return;
        }

        addItem(product, 1, unit);
        showNotification('success', 'Produto adicionado!');
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 50);
    };

    const handleConfirmQuantity = () => {
        const qty = parseFloat(quantityInput);
        if (!qty || qty <= 0) {
            showNotification('Quantidade inválida', 'warning');
            return;
        }

        const isCold = itemPriceType === 'cold';
        const existingItem = items.find(item => item.id === selectedProduct.id && !item.unit && ((item.isCold || false) === isCold));
        const currentQtyInCart = existingItem ? existingItem.quantity : 0;
        const totalQty = currentQtyInCart + qty;

        const allCartItemsForProduct = items.filter(item => item.id === selectedProduct.id && ((item.isCold || false) === isCold));
        const totalStockUsed = allCartItemsForProduct.reduce((acc, item) => {
            const itemDeduction = item.unit ? item.unit.multiplier : 1;
            if (item.id === selectedProduct.id && !item.unit) return acc;
            return acc + (item.quantity * itemDeduction);
        }, 0);

        const baseStock = isCold ? Number(selectedProduct.coldStock || 0) : Number(selectedProduct.stock || 0);
        const reserved = isCold ? Number(selectedProduct.reservedColdStock || 0) : Number(selectedProduct.reservedStock || 0);
        const availableStock = Math.max(0, baseStock - reserved);
        const stockType = isCold ? 'mercearia' : 'atacado';

        if (totalStockUsed + qty > availableStock) {
            showNotification(`Estoque ${stockType} insuficiente. Disponível: ${availableStock} (Reservado: ${reserved})`, 'warning');
            return;
        }

        const customPrice = typeof priceInput === 'string' ? parseFloat(String(priceInput).replace(/[^0-9.,]/g, '').replace('.', '').replace(',', '.')) : Number(priceInput);
        addItem(selectedProduct, qty, null, {
            itemPriceType,
            customPrice: !isNaN(customPrice) && customPrice > 0 ? customPrice : undefined
        });
        setQuantityModalOpen(false);
        setQuantityStep('quantity');
        setQuantityInput('1');
        setPriceInput('');
        showNotification('Produto adicionado!', 'success');
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 100);
    };

    const handleCheckout = () => {


        if (!isManager) {
            showNotification('Apenas gerente pode finalizar vendas', 'warning');
            return;
        }

        if (!currentCashRegister) {
            showNotification('Abra o caixa antes de realizar vendas', 'warning');
            return;
        }

        if (items.length === 0) {
            showNotification('Adicione produtos ao carrinho', 'warning');
            return;
        }

        setPayments([]);
        setPaymentAmount('');
        setPaymentMethod('Dinheiro');
        setPaymentModalOpen(true);
    };

    const handleAddPayment = () => {
        const amount = parseFloat(paymentAmount);
        if (!amount || amount <= 0) {
            showNotification('Informe um valor válido', 'warning');
            return;
        }

        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

        if (totalPaid + amount > totals.total + 1000) {
            showNotification('Valor muito alto', 'warning');
            return;
        }

        setPayments([...payments, { method: paymentMethod, amount }]);
        setPaymentAmount('');
    };

    const handleRemovePayment = (index) => {
        setPayments(payments.filter((_, i) => i !== index));
    };

    const handleSavePresale = () => {
        if (items.length === 0) {
            showNotification('Adicione produtos ao carrinho', 'warning');
            return;
        }
        setPresaleCustomerName(customer?.name || '');
        setPresaleModalOpen(true);
    };

    const confirmSavePresale = async () => {
        try {
            setProcessing(true);
            const totals = calculateTotals();

            const presaleType = priceType === 'cold' ? 'cold' : (customer?.priceType === 'wholesale' ? 'wholesale' : null);
            const presaleItems = items.map(item => {
                const pid = item.id || item.productId;
                const cached = products.find(p => p.id === pid);
                const pname = item.name || item.productName || (cached ? cached.name : null) || 'Item';
                return {
                    productId: pid,
                    productName: pname,
                    quantity: Number(item.quantity) || 0,
                    unitPrice: Number(item.unitPrice) || 0,
                    discount: Number(item.discount) || 0,
                    total: Number(item.total) || 0,
                    unit: item.unit || null,
                    isCold: !!item.isCold
                };
            });
            const presaleData = {
                customerId: customer?.id || null,
                customerName: presaleCustomerName || 'Cliente Balcão',
                items: presaleItems,
                subtotal: totals.subtotal,
                discount: totals.discount + totals.itemsDiscount,
                total: totals.total,
                priceType: presaleType,
                customerPriceType: customer?.priceType || null,
                status: 'pending',
                createdBy: user?.name || 'Operador'
            };

            // Remove undefined values to prevent Firestore errors
            const cleanPresaleData = JSON.parse(JSON.stringify(presaleData));

            for (const item of items) {
                const pid = item.id || item.productId;
                if (!pid) continue;
                const product = await productService.getById(pid);
                if (!product) {
                    showNotification('Produto não encontrado para reserva', 'error');
                    setProcessing(false);
                    return;
                }
                const deduction = item.stockDeductionPerUnit ? (item.stockDeductionPerUnit * Number(item.quantity || 0)) : (item.unit && item.unit.multiplier ? (Number(item.quantity || 0) * item.unit.multiplier) : Number(item.quantity || 0));
                const isColdItem = !!item.isCold;
                const baseStock = isColdItem ? Number(product.coldStock || 0) : Number(product.stock || 0);
                const reservedKey = isColdItem ? 'reservedColdStock' : 'reservedStock';
                const alreadyReserved = Number(product[reservedKey] || 0);
                const available = baseStock - alreadyReserved;
                if (deduction > available) {
                    showNotification('Estoque insuficiente para reservar este pedido', 'warning');
                    setProcessing(false);
                    return;
                }
                const updated = {};
                updated[reservedKey] = alreadyReserved + deduction;
                await productService.update(product.id, updated);
                setProducts(prev => prev.map(p => {
                    if (p.id !== product.id) return p;
                    return { ...p, ...updated };
                }));
                if (selectedProduct && selectedProduct.id === product.id) {
                    setSelectedProduct(prev => ({ ...prev, ...updated }));
                }
            }

            if (presaleId) {
                await presalesService.update(presaleId, { ...cleanPresaleData, reserved: true });
                showNotification('Pré-venda atualizada com sucesso!', 'success');
            } else {
                await presalesService.create({ ...cleanPresaleData, reserved: true });
                showNotification('Pré-venda salva com sucesso!', 'success');
            }

            clearCart();
            setPresaleModalOpen(false);
        } catch (error) {
            console.error('Error saving presale:', error);
            showNotification('Erro ao salvar pré-venda', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const handleFinalizeSale = async () => {
        try {
            setProcessing(true);

            if (!isManager) {
                showNotification('Permissão negada: somente gerente pode finalizar', 'error');
                setProcessing(false);
                return;
            }

            const totals = calculateTotals();
            const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

            if (totalPaid < totals.total) {
                showNotification('Valor pago insuficiente', 'error');
                setProcessing(false);
                return;
            }

            const computedTotalPaid = isEditingSale ? Number((editingSale?.originalTotal || 0) + totalPaid) : Number(totalPaid) || 0;
            const change = Math.max(0, computedTotalPaid - totals.total);
            const cartData = getCartData();

            // Calculate total savings
            const totalSavings = items.reduce((sum, item) => {
                const retailPrice = item.retailPrice || item.unitPrice;
                const wholesalePrice = item.unitPrice;
                const savingsPerUnit = Math.max(0, retailPrice - wholesalePrice);
                return sum + (savingsPerUnit * item.quantity);
            }, 0);

            const getDeduction = (it) => {
                if (it.stockDeductionPerUnit) return it.stockDeductionPerUnit * it.quantity;
                if (it.unit && it.unit.multiplier) return it.quantity * it.unit.multiplier;
                return it.quantity;
            };

            if (!currentCashRegister || !currentCashRegister.id) {
                showNotification('Erro: Nenhum caixa aberto identificado.', 'error');
                setProcessing(false);
                return;
            }

            const saleData = {
                cashRegisterId: currentCashRegister.id,
                customerId: customer?.id || null,
                customerName: customer?.name || 'Cliente Padrão',
                items: items.map(item => {
                    const pid = item.id || null;
                    const cached = pid ? (products.find(p => p.id === pid) || null) : null;
                    const pname = item.name || item.productName || (cached ? cached.name : null) || 'Item';
                    return {
                        productId: pid,
                        productName: pname,
                        quantity: Number(item.quantity) || 0,
                        unitPrice: Number(item.unitPrice) || 0,
                        unitCost: Number(item.unitCost) || 0,
                        retailPrice: Number(item.retailPrice || item.unitPrice) || 0,
                        discount: Number(item.discount) || 0,
                        total: Number(item.total) || 0,
                        unit: item.unit || null,
                        isCold: !!item.isCold
                    };
                }),
                subtotal: Number(totals.subtotal) || 0,
                discount: Number(totals.discount + totals.itemsDiscount) || 0,
                total: Number(totals.total) || 0,
                totalSavings: Number(totalSavings) || 0,
                payments: payments.map(p => ({
                    method: p.method || 'Dinheiro',
                    amount: Number(p.amount) || 0
                })),
                paymentMethod: payments[0]?.method || 'Dinheiro',
                priceType: priceType || 'retail',
                totalPaid: computedTotalPaid,
                change,
                paymentStatus: 'paid',
                createdBy: user?.name || 'Operador'
            };

            // Remove undefined values to prevent Firestore errors
            const cleanSaleData = JSON.parse(JSON.stringify(saleData));

            let saleNumber = isEditingSale ? String(editingSale?.saleNumber || '') : generateSaleNumber();
            const sale = { ...cleanSaleData, saleNumber };

            printReceipt(sale, settings);
            showNotification('Venda realizada com sucesso!', 'success');
            clearCart();
            setPaymentModalOpen(false);
            setPayments([]);
            setSearchTerm('');
            setProcessing(false);

            Promise.resolve().then(async () => {
                try {
                    const ids = Array.from(new Set(items.map(it => it.id).filter(Boolean)));
                    const localById = new Map();
                    for (const id of ids) {
                        const cached = products.find(p => p.id === id);
                        if (cached) localById.set(id, cached);
                    }
                    if (change > 0) {
                        await cashRegisterService.addMovement({
                            cashRegisterId: currentCashRegister.id,
                            type: 'change',
                            amount: change,
                            description: `Troco da venda #${sale.saleNumber}`,
                            createdBy: user?.name || 'Sistema'
                        });
                    }
                } catch (error) {}

                try {
                    if (isEditingSale) {
                        await salesService.update(editingSale.id, { ...cleanSaleData, saleNumber, status: 'modified' });
                    } else {
                        await firestoreService.create(COLLECTIONS.SALES, sale);
                    }
                } catch {}

                const missingIds = ids.filter(id => !localById.has(id));
                if (missingIds.length > 0) {
                    try {
                        const fetched = await Promise.all(missingIds.map(id => productService.getById(id).catch(() => null)));
                        fetched.forEach(p => { if (p && p.id) localById.set(p.id, p); });
                    } catch {}
                }
                const deductionsMap = new Map();
                for (const item of items) {
                    if (!item.id) continue;
                    const d = getDeduction(item);
                    const entry = deductionsMap.get(item.id) || { cold: 0, warm: 0 };
                    if (item.isCold) entry.cold += d; else entry.warm += d;
                    deductionsMap.set(item.id, entry);
                }
                const stockUpdates = [];
                deductionsMap.forEach((entry, id) => {
                    const product = localById.get(id);
                    if (!product) return;
                    const payload = {};
                    if (entry.cold > 0) {
                        const newCold = Math.max(0, Number(product.coldStock || 0) - entry.cold);
                        payload.coldStock = newCold;
                    }
                    if (entry.warm > 0) {
                        const newWarm = Math.max(0, Number(product.stock || 0) - entry.warm);
                        payload.stock = newWarm;
                    }
                    if (Object.keys(payload).length > 0) {
                        stockUpdates.push(
                            productService.update(id, payload).then(() => {
                                setProducts(prev => prev.map(p => {
                                    if (p.id !== id) return p;
                                    const next = { ...p };
                                    if (payload.coldStock !== undefined) next.coldStock = payload.coldStock;
                                    if (payload.stock !== undefined) next.stock = payload.stock;
                                    return next;
                                }));
                            }).catch(() => {})
                        );
                    }
                });
                try { await Promise.all(stockUpdates); } catch {}

                if (cartData.presaleId) {
                    try {
                        const reservedUpdates = [];
                        deductionsMap.forEach((entry, id) => {
                            const product = localById.get(id);
                            if (!product) return;
                            const payload = {};
                            if (entry.cold > 0) {
                                const current = Number(product.reservedColdStock || 0);
                                const next = Math.max(0, current - entry.cold);
                                payload.reservedColdStock = next;
                            }
                            if (entry.warm > 0) {
                                const current = Number(product.reservedStock || 0);
                                const next = Math.max(0, current - entry.warm);
                                payload.reservedStock = next;
                            }
                            if (Object.keys(payload).length > 0) {
                                reservedUpdates.push(
                                    productService.update(id, payload).then(() => {
                                        setProducts(prev => prev.map(p => {
                                            if (p.id !== id) return p;
                                            const nextP = { ...p };
                                            if (payload.reservedColdStock !== undefined) nextP.reservedColdStock = payload.reservedColdStock;
                                            if (payload.reservedStock !== undefined) nextP.reservedStock = payload.reservedStock;
                                            return nextP;
                                        }));
                                    }).catch(() => {})
                                );
                            }
                        });
                        try { await Promise.all(reservedUpdates); } catch {}
                        await presalesService.update(cartData.presaleId, { status: 'completed', reserved: false });
                    } catch {}
                }
            });

        } catch (error) {
            console.error('Error finalizing sale:', error);
            showNotification('Erro ao finalizar venda', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const handleCustomerSelect = (selectedCustomer) => {
        setCustomer(selectedCustomer);
        setCustomerSelectionOpen(false);
        showNotification(`Cliente ${selectedCustomer.name} selecionado`, 'success');
    };

    const handleSaveNewCustomer = async (customerData) => {
        try {
            const newCustomer = await customerService.create(customerData);
            setCustomer(newCustomer);
            setNewCustomerModalOpen(false);
            setCustomerSelectionOpen(false);
            showNotification('Cliente cadastrado e selecionado', 'success');
        } catch (error) {
            console.error('Error creating customer:', error);
            showNotification('Erro ao cadastrar cliente', 'error');
        }
    };

    return (
        <div className="fade-in">
            <h1 style={{ marginBottom: 'var(--spacing-xl)' }}>Ponto de Venda</h1>

            <div className="grid grid-3" style={{ gap: 'var(--spacing-lg)', alignItems: 'start' }}>
                {/* Left: Product Search */}
                <div style={{ gridColumn: 'span 2' }}>
                    <Card title="Buscar Produtos">
                        <Input
                            ref={searchInputRef}
                            placeholder="Digite o nome ou código de barras..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            icon={<Search size={20} />}
                            autoFocus
                        />

                        {filteredProducts.length > 0 && (
                            <div style={{
                                marginTop: 'var(--spacing-md)',
                                maxHeight: '400px',
                                overflowY: 'auto',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                {filteredProducts.map((product, index) => (
                                    <div
                                        key={product.id}
                                        onClick={() => handleProductSelect(product)}
                                        style={{
                                            padding: 'var(--spacing-md)',
                                            borderBottom: '1px solid var(--color-divider)',
                                            cursor: 'pointer',
                                            transition: 'background var(--transition-fast)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            background: index === selectedIndex ? 'var(--color-bg-hover)' : 'transparent'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (index !== selectedIndex) e.currentTarget.style.background = 'var(--color-bg-hover)'
                                        }}
                                        onMouseLeave={(e) => {
                                            if (index !== selectedIndex) e.currentTarget.style.background = 'transparent'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{product.name}</div>
                                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                                {product.barcode || 'Sem código'}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                <span style={{ padding: '2px 6px', borderRadius: '6px', background: 'var(--color-bg-secondary)', fontSize: '12px' }}>
                                                    Disponível Atacado: <strong>{Math.max(0, Number(product.stock || 0) - Number(product.reservedStock || 0))}</strong> {product.unitOfMeasure || 'UN'}
                                                </span>
                                                <span style={{ padding: '2px 6px', borderRadius: '6px', background: 'var(--color-bg-secondary)', fontSize: '12px', color: 'var(--color-info)' }}>
                                                    Disponível Mercearia: <strong>{Math.max(0, Number(product.coldStock || 0) - Number(product.reservedColdStock || 0))}</strong> {product.coldUnit || product.unitOfMeasure || 'UN'}
                                                </span>
                                                <span style={{ padding: '2px 6px', borderRadius: '6px', background: 'var(--color-bg-secondary)', fontSize: '12px', color: 'var(--color-warning)' }}>
                                                    Reservado Pré-venda (Atacado): <strong>{Number(product.reservedStock || 0)}</strong>
                                                </span>
                                                <span style={{ padding: '2px 6px', borderRadius: '6px', background: 'var(--color-bg-secondary)', fontSize: '12px', color: 'var(--color-warning)' }}>
                                                    Reservado Pré-venda (Mercearia): <strong>{Number(product.reservedColdStock || 0)}</strong>
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Atacado</div>
                                            <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                                                {formatCurrency(product.wholesalePrice || product.price)}
                                            </div>
                                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Mercearia</div>
                                            <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                                                {formatCurrency(product.coldPrice || product.price)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <div style={{ marginTop: 'var(--spacing-lg)' }}>
                        <Card title="Itens do Carrinho">
                            {items.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                                    <ShoppingCart size={48} style={{ marginBottom: 'var(--spacing-md)', opacity: 0.5 }} />
                                    <p>Carrinho vazio</p>
                                    <p style={{ fontSize: 'var(--font-size-sm)' }}>Use a busca acima para adicionar produtos</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                    {items.map(item => (
                                        <div key={item.id} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: 'var(--spacing-md)',
                                            background: 'var(--color-bg-secondary)',
                                            borderRadius: 'var(--radius-md)'
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600 }}>{item.name}</div>
                                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                                    {formatCurrency(item.unitPrice)} x {item.quantity}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                                <div style={{ fontWeight: 600 }}>
                                                    {formatCurrency(item.total)}
                                                </div>
                                                <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                        icon={<Minus size={14} />}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                        icon={<Plus size={14} />}
                                                    />
                                                    <Button
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() => removeItem(item.id)}
                                                        icon={<Trash2 size={14} />}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>

                {/* Right: Totals & Actions */}
                <div>
                    <Card>
                        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                            <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Resumo</h3>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                                <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal</span>
                                <span>{formatCurrency(totals.subtotal)}</span>
                            </div>

                            {(totals.discount > 0 || totals.itemsDiscount > 0) && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)', color: 'var(--color-success)' }}>
                                    <span>Desconto</span>
                                    <span>-{formatCurrency(totals.discount + totals.itemsDiscount)}</span>
                                </div>
                            )}

                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginTop: 'var(--spacing-md)',
                                paddingTop: 'var(--spacing-md)',
                                borderTop: '1px solid var(--color-border)',
                                fontSize: 'var(--font-size-xl)',
                                fontWeight: 700
                            }}>
                                <span>Total</span>
                                <span>{formatCurrency(totals.total)}</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                Cliente
                            </label>
                            <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                                <div style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    background: 'var(--color-bg-input)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    fontSize: 'var(--font-size-sm)'
                                }}>
                                    {customer ? customer.name : 'Cliente Padrão'}
                                </div>
                                <Button
                                    variant="secondary"
                                    icon={<User size={16} />}
                                    onClick={() => setCustomerSelectionOpen(true)}
                                />
                                {customer && (
                                    <Button
                                        variant="ghost"
                                        icon={<X size={16} />}
                                        onClick={() => setCustomer(null)}
                                    />
                                )}
                            </div>
                        </div>

                        

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <Button
                                variant="success"
                                size="lg"
                                icon={<CreditCard size={20} />}
                                onClick={handleCheckout}
                                disabled={items.length === 0 || !isManager}
                            >
                                Finalizar Venda (F2)
                            </Button>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                <Button
                                    variant="secondary"
                                    icon={<Save size={18} />}
                                    onClick={handleSavePresale}
                                    disabled={items.length === 0}
                                >
                                    Salvar (F3)
                                </Button>
                                <Button
                                    variant="danger"
                                    icon={<Trash2 size={18} />}
                                    onClick={clearCart}
                                    disabled={items.length === 0}
                                >
                                    Limpar (F4)
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Quantity Modal */}
            <Modal
                isOpen={quantityModalOpen}
                onClose={() => setQuantityModalOpen(false)}
                title="Quantidade"
                size="md"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <p>
                        Produto: <strong>{selectedProduct?.name}</strong>
                    </p>
                    <Input
                        ref={quantityInputRef}
                        type="number"
                        label="Quantidade"
                        value={quantityInput}
                        onChange={(e) => setQuantityInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                setQuantityStep('priceType');
                                setTimeout(() => {
                                    wholesaleBtnRef.current?.focus();
                                }, 0);
                            }
                        }}
                        onKeyUp={(e) => {
                            if (e.key === 'Enter') e.preventDefault();
                        }}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') e.preventDefault();
                        }}
                        autoFocus
                    />
                    <div>
                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>
                            Tipo de Preço (por item)
                        </label>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                            <Button
                                ref={wholesaleBtnRef}
                                variant={itemPriceType === 'wholesale' ? 'primary' : 'secondary'}
                                onClick={() => {
                                    setItemPriceType('wholesale');
                                    setQuantityStep('price');
                                    if (selectedProduct) setPriceInput(selectedProduct.wholesalePrice || selectedProduct.price);
                                    setTimeout(() => {
                                        priceInputRef.current?.focus();
                                    }, 0);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setItemPriceType('wholesale');
                                        setQuantityStep('price');
                                        if (selectedProduct) setPriceInput(selectedProduct.wholesalePrice || selectedProduct.price);
                                        setTimeout(() => {
                                            priceInputRef.current?.focus();
                                        }, 0);
                                    } else if (e.key === 'ArrowRight') {
                                        e.preventDefault();
                                        setItemPriceType('cold');
                                        if (selectedProduct) setPriceInput(selectedProduct.coldPrice || selectedProduct.price);
                                        coldBtnRef.current?.focus();
                                    } else if (e.key === 'Tab') {
                                        e.preventDefault();
                                        setItemPriceType('wholesale');
                                        setQuantityStep('price');
                                        setTimeout(() => {
                                            priceInputRef.current?.focus();
                                        }, 0);
                                    }
                                }}
                            >
                                Atacado
                            </Button>
                            <Button
                                ref={coldBtnRef}
                                variant={itemPriceType === 'cold' ? 'primary' : 'secondary'}
                                onClick={() => {
                                    setItemPriceType('cold');
                                    setQuantityStep('price');
                                    if (selectedProduct) setPriceInput(selectedProduct.coldPrice || selectedProduct.price);
                                    setTimeout(() => {
                                        priceInputRef.current?.focus();
                                    }, 0);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setItemPriceType('cold');
                                        setQuantityStep('price');
                                        if (selectedProduct) setPriceInput(selectedProduct.coldPrice || selectedProduct.price);
                                        setTimeout(() => {
                                            priceInputRef.current?.focus();
                                        }, 0);
                                    } else if (e.key === 'ArrowLeft') {
                                        e.preventDefault();
                                        setItemPriceType('wholesale');
                                        if (selectedProduct) setPriceInput(selectedProduct.wholesalePrice || selectedProduct.price);
                                        wholesaleBtnRef.current?.focus();
                                    } else if (e.key === 'Tab') {
                                        e.preventDefault();
                                        setItemPriceType('cold');
                                        setQuantityStep('price');
                                        setTimeout(() => {
                                            priceInputRef.current?.focus();
                                        }, 0);
                                    }
                                }}
                            >
                                Mercearia
                            </Button>
                        </div>
                        <div style={{ marginTop: '6px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                            Preço Selecionado: <span style={{ color: 'var(--color-primary)' }}>
                                {formatCurrency(itemPriceType === 'cold'
                                    ? (selectedProduct ? (selectedProduct.coldPrice || selectedProduct.price || 0) : 0)
                                    : (selectedProduct ? (selectedProduct.wholesalePrice || selectedProduct.price || 0) : 0)
                                )}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--spacing-lg)', marginTop: 'var(--spacing-xs)' }}>
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                Atacado: <strong>{selectedProduct ? formatCurrency((selectedProduct.wholesalePrice ?? selectedProduct.price) || 0) : '-'}</strong>
                            </span>
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                Mercearia: <strong>{selectedProduct ? formatCurrency((selectedProduct.coldPrice ?? selectedProduct.price) || 0) : '-'}</strong>
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--spacing-lg)', marginTop: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                Disponível Atacado: <strong>{selectedProduct ? String(Math.max(0, Number(selectedProduct.stock ?? 0) - Number(selectedProduct.reservedStock ?? 0))) : '-'}</strong>
                            </span>
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                Disponível Mercearia: <strong>{selectedProduct ? String(Math.max(0, Number(selectedProduct.coldStock ?? 0) - Number(selectedProduct.reservedColdStock ?? 0))) : '-'}</strong>
                            </span>
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-warning)' }}>
                                Reservado Pré-venda (Atacado): <strong>{selectedProduct ? String(Number(selectedProduct.reservedStock ?? 0)) : '-'}</strong>
                            </span>
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-warning)' }}>
                                Reservado Pré-venda (Mercearia): <strong>{selectedProduct ? String(Number(selectedProduct.reservedColdStock ?? 0)) : '-'}</strong>
                            </span>
                        </div>
                    </div>
                    <CurrencyInput
                        ref={priceInputRef}
                        label="Preço (opcional)"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleConfirmQuantity();
                            }
                        }}
                        placeholder="0,00"
                        className="no-margin"
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)' }}>
                        <Button variant="ghost" onClick={() => setQuantityModalOpen(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={handleConfirmQuantity}>Confirmar</Button>
                    </div>
                </div>
            </Modal>

            {/* Payment Modal */}
            <Modal
                isOpen={paymentModalOpen}
                onClose={() => setPaymentModalOpen(false)}
                title="Finalizar Venda"
                size="md"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-md)' }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Total a Pagar</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                            {isEditingSale ? formatCurrency(Math.max(0, totals.total - (editingSale?.originalTotal || 0))) : formatCurrency(totals.total)}
                        </div>
                        {(isEditingSale ? (Math.max(0, totals.total - (editingSale?.originalTotal || 0)) - payments.reduce((sum, p) => sum + p.amount, 0)) > 0 : (totals.total - payments.reduce((sum, p) => sum + p.amount, 0) > 0)) && (
                            <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-warning)', marginTop: 'var(--spacing-xs)' }}>
                                Restante: {isEditingSale ? formatCurrency(Math.max(0, (totals.total - (editingSale?.originalTotal || 0)) - payments.reduce((sum, p) => sum + p.amount, 0))) : formatCurrency(totals.total - payments.reduce((sum, p) => sum + p.amount, 0))}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1, marginBottom: 0 }}>
                            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                                Forma de Pagamento
                            </label>
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                style={{
                                    width: '100%',
                                    height: '48px',
                                    padding: '0 10px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-bg-tertiary)',
                                    color: 'var(--color-text-primary)',
                                    outline: 'none'
                                }}
                            >
                                <option value="Dinheiro" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}>Dinheiro</option>
                                <option value="Cartão de Crédito" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}>Cartão de Crédito</option>
                                <option value="Cartão de Débito" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}>Cartão de Débito</option>
                                <option value="PIX" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}>PIX</option>
                            </select>
                        </div>
                        <div style={{ flex: 1, marginBottom: 0 }}>
                            <CurrencyInput
                                label="Valor"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddPayment();
                                }}
                                placeholder="0,00"
                                autoFocus
                                className="no-margin"
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <Button
                                onClick={handleAddPayment}
                                icon={<Plus size={20} />}
                                style={{ height: '48px', width: '48px', padding: 0 }}
                            />
                        </div>
                    </div>

                    {payments.length > 0 && (
                        <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                            {payments.map((payment, index) => (
                                <div key={index} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: 'var(--spacing-sm) var(--spacing-md)',
                                    borderBottom: '1px solid var(--color-border)'
                                }}>
                                    <span>{payment.method}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                        <span style={{ fontWeight: 600 }}>{formatCurrency(payment.amount)}</span>
                                        <button
                                            onClick={() => handleRemovePayment(index)}
                                            style={{ color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: 'var(--spacing-md)',
                                fontWeight: 600,
                                background: 'var(--color-bg-hover)'
                            }}>
                                <span>Total Pago</span>
                                <span style={{
                                    color: payments.reduce((sum, p) => sum + p.amount, 0) >= totals.total ? 'var(--color-success)' : 'var(--color-warning)'
                                }}>
                                    {formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0))}
                                </span>
                            </div>
                            {payments.reduce((sum, p) => sum + p.amount, 0) > totals.total && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: 'var(--spacing-md)',
                                    fontWeight: 600,
                                    color: 'var(--color-primary)',
                                    borderTop: '1px solid var(--color-border)'
                                }}>
                                    <span>Troco</span>
                                    <span>{formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0) - totals.total)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
                        <Button variant="ghost" onClick={() => setPaymentModalOpen(false)}>Cancelar</Button>
                        <Button
                            variant="success"
                            onClick={handleFinalizeSale}
                            disabled={
                                !isManager ||
                                processing ||
                                (isEditingSale
                                    ? (payments.reduce((sum, p) => sum + p.amount, 0) < Math.max(0, totals.total - (editingSale?.originalTotal || 0)))
                                    : (payments.reduce((sum, p) => sum + p.amount, 0) < totals.total)
                                )
                            }
                            loading={processing}
                            icon={<Printer size={18} />}
                        >
                            Finalizar e Imprimir (F6)
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Presale Modal */}
            <Modal
                isOpen={presaleModalOpen}
                onClose={() => setPresaleModalOpen(false)}
                title="Salvar Pré-venda"
                size="sm"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {(priceType === 'cold' || (customer && customer.priceType === 'wholesale')) && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {priceType === 'cold' && (
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: 'var(--color-primary)',
                                    color: '#fff',
                                    border: '1px solid var(--color-primary)'
                                }}>
                                    Mercearia
                                </span>
                            )}
                            {customer && customer.priceType === 'wholesale' && (
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: 'var(--color-success)',
                                    color: '#fff',
                                    border: '1px solid var(--color-success)'
                                }}>
                                    Atacado
                                </span>
                            )}
                        </div>
                    )}
                    <Input
                        label="Nome do Cliente (Opcional)"
                        value={presaleCustomerName}
                        onChange={(e) => setPresaleCustomerName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') confirmSavePresale(); }}
                        placeholder="Identificação do cliente"
                        autoFocus
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)' }}>
                        <Button variant="ghost" onClick={() => setPresaleModalOpen(false)}>Cancelar</Button>
                        <Button
                            variant="primary"
                            onClick={confirmSavePresale}
                            loading={processing}
                        >
                            Salvar
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Customer Selection Modal */}
            <Modal
                isOpen={customerSelectionOpen}
                onClose={() => setCustomerSelectionOpen(false)}
                title="Selecionar Cliente"
                size="md"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                        <div style={{ flex: 1 }}>
                            <Input
                                placeholder="Buscar cliente..."
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                icon={<Search size={18} />}
                                autoFocus
                            />
                        </div>
                        <Button
                            onClick={() => setNewCustomerModalOpen(true)}
                            icon={<Plus size={18} />}
                        >
                            Novo
                        </Button>
                    </div>

                    <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                        {customers
                            .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
                            .map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => handleCustomerSelect(c)}
                                    style={{
                                        padding: 'var(--spacing-md)',
                                        borderBottom: '1px solid var(--color-divider)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                    className="hover-bg"
                                >
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                            {c.phone || c.email || 'Sem contato'}
                                        </div>
                                    </div>
                                    {c.priceType === 'wholesale' && (
                                        <span style={{
                                            fontSize: 'var(--font-size-xs)',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            background: 'var(--color-primary-light)',
                                            color: 'var(--color-primary)'
                                        }}>
                                            Atacado
                                        </span>
                                    )}
                                </div>
                            ))
                        }
                        {customers.length === 0 && (
                            <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                                Nenhum cliente encontrado
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button variant="ghost" onClick={() => setCustomerSelectionOpen(false)}>Cancelar</Button>
                    </div>
                </div>
            </Modal>

            {/* New Customer Modal */}
            {newCustomerModalOpen && (
                <CustomerFormModal
                    isOpen={newCustomerModalOpen}
                    onClose={() => setNewCustomerModalOpen(false)}
                    onSave={handleSaveNewCustomer}
                />
            )}
        </div>
    );
};

// Simple Customer Form Modal Component
const CustomerFormModal = ({ isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        document: '',
        priceType: 'retail'
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name) return;
        onSave(formData);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Novo Cliente">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                <Input
                    label="Nome"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    autoFocus
                />
                <Input
                    label="Telefone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <Input
                    label="CPF/CNPJ"
                    value={formData.document}
                    onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                />
                <div>
                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>
                        Tipo de Preço
                    </label>
                    <select
                        value={formData.priceType}
                        onChange={(e) => setFormData({ ...formData, priceType: e.target.value })}
                        style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-tertiary)',
                            color: 'var(--color-text-primary)'
                        }}
                    >
                        <option value="retail" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}>Varejo</option>
                        <option value="wholesale" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}>Atacado</option>
                    </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-sm)' }}>
                    <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" variant="primary">Salvar</Button>
                </div>
            </form>
        </Modal>
    );
};

export default SalesPage;
