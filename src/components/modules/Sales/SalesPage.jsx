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
import { formatCurrency } from '../../../utils/formatters';
import { printReceipt } from '../../../utils/receiptPrinter';
import { cashRegisterService } from '../../../services/firestore';

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

    const { showNotification, currentCashRegister, settings, setBusy } = useApp();
    const { user, isManager, isCashier } = useAuth();

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

    // Customer Selection Modal
    const [customerSelectionOpen, setCustomerSelectionOpen] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');

    // New Customer Modal
    const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);

    // Presale Modal
    const [presaleModalOpen, setPresaleModalOpen] = useState(false);
    const [presaleCustomerName, setPresaleCustomerName] = useState('');
    const [reservedCount, setReservedCount] = useState(0);
    const [reservedColdCount, setReservedColdCount] = useState(0);
    const [reservedNatCount, setReservedNatCount] = useState(0);

    const searchInputRef = useRef(null);
    const quantityInputRef = useRef(null);
    const atacadoBtnRef = useRef(null);
    const geladaBtnRef = useRef(null);
    const priceInputRef = useRef(null);

    const canCheckout = !!(currentCashRegister && currentCashRegister.id) && (isManager || isCashier);
    const totals = calculateTotals();
    const creditFeePct = Number(settings?.cardCreditFee || 0) / 100;
    const debitFeePct = Number(settings?.cardDebitFee || 0) / 100;
    const creditPaid = payments.filter(p => p.method === 'Cartão de Crédito').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const debitPaid = payments.filter(p => p.method === 'Cartão de Débito').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const feeCredit = creditPaid * creditFeePct;
    const feeDebit = debitPaid * debitFeePct;
    const feesTotal = feeCredit + feeDebit;
    const isEditingSale = !!editingSale;

    // Payment input starts at 0; user types given amount to compute troco
    useEffect(() => {
        if (paymentModalOpen) {
            setPaymentAmount(0);
        }
    }, [paymentModalOpen]);

    useEffect(() => {
        loadProducts();
        loadCustomers();
    }, []);

    useEffect(() => {
        const active = paymentModalOpen || presaleModalOpen || quantityModalOpen || customerSelectionOpen || newCustomerModalOpen || processing;
        setBusy(active);
        return () => setBusy(false);
    }, [paymentModalOpen, presaleModalOpen, quantityModalOpen, customerSelectionOpen, newCustomerModalOpen, processing]);

    useEffect(() => {
        const interval = setInterval(() => {
            loadProducts();
            loadCustomers();
        }, 15000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (searchTerm) {
            const filtered = products
                .filter(p =>
                    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (p.barcode && p.barcode.includes(searchTerm))
                )
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
            setFilteredProducts(filtered);
            setSelectedIndex(-1);
        } else {
            setFilteredProducts([]);
            setSelectedIndex(-1);
        }
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
            setProducts(data.filter(p => p.active !== false));
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
            const term = String(searchTerm || '').trim();

            if (term) {
                // Priorize exact barcode match (product or unit)
                const exactProduct = products.find(p => String(p.barcode || '').trim() === term);

                if (exactProduct) {
                    handleProductSelect(exactProduct);
                    return;
                }

                let foundUnit = null;
                let foundProduct = null;
                for (const p of products) {
                    if (p.units && p.units.length > 0) {
                        const unit = p.units.find(u => String(u.barcode || '').trim() === term);
                        if (unit) {
                            foundProduct = p;
                            foundUnit = unit;
                            break;
                        }
                    }
                }
                if (foundProduct && foundUnit) {
                    await addToCart(foundProduct, foundUnit);
                    setSearchTerm('');
                    setFilteredProducts([]);
                    return;
                }

                // If numeric code typed, try prefix match to add directly
                if (/^\d+$/.test(term)) {
                    const isColdReq = priceType === 'cold';
                    const hasStock = (p) => isColdReq ? ((p.coldStock || 0) > 0) : ((p.stock || 0) > 0);
                    const pref = products.find(p => String(p.barcode || '').trim().startsWith(term) && hasStock(p));
                    if (pref) {
                        handleProductSelect(pref);
                        return;
                    }
                }
            }

            // If not barcode, open modal for the selected product or the first available result
            if (filteredProducts.length > 0) {
                let idx = selectedIndex >= 0 && selectedIndex < filteredProducts.length ? selectedIndex : 0;
                let candidate = filteredProducts[idx];
                const hasAnyStock = (p) => ((p.stock || 0) > 0) || ((p.coldStock || 0) > 0);
                if (!hasAnyStock(candidate)) {
                    const alt = filteredProducts.find(hasAnyStock);
                    if (alt) candidate = alt;
                }
                if (candidate && hasAnyStock(candidate)) {
                    handleProductSelect(candidate);
                } else {
                    showNotification('Nenhum produto com estoque disponível', 'warning');
                }
            }
        }
    };

    const handleProductSelect = (product) => {
        const nat = product.stock || 0;
        const cold = product.coldStock || 0;
        if ((nat <= 0) && (cold <= 0)) {
            showNotification('Produto sem estoque', 'warning');
            return;
        }

        setSelectedProduct(product);
        setQuantityInput('1');
        const defaultType = nat > 0 ? 'wholesale' : 'cold';
        setItemPriceType(defaultType);
        const defaultPrice = defaultType === 'cold'
            ? (product.coldPrice || product.price)
            : (product.wholesalePrice || product.price);
        setPriceInput(defaultPrice);
        setReservedCount(0);
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

        (async () => {
            try {
                const presales = await presalesService.getByStatus('pending');
                let reserved = 0;
                let reservedCold = 0;
                let reservedNat = 0;
                for (const presale of presales || []) {
                    const items = Array.isArray(presale.items) ? presale.items : [];
                    for (const it of items) {
                        const pid = it.productId || it.id;
                        if (pid !== product.id) continue;
                        const qty = Number(it.quantity || 0);
                        let ded = qty;
                        if (it.stockDeductionPerUnit) {
                            ded = it.stockDeductionPerUnit * qty;
                        } else if (it.unit && it.unit.multiplier) {
                            ded = it.unit.multiplier * qty;
                        }
                        reserved += ded;
                        if (it.isCold) reservedCold += ded; else reservedNat += ded;
                    }
                }
                setReservedCount(reserved);
                setReservedColdCount(reservedCold);
                setReservedNatCount(reservedNat);
                if (reserved > 0) {
                    if ((nat <= 0) && (cold <= 0)) {
                        showNotification(`Produto zerado; ${reserved} unidade(s) reservada(s) em pré-vendas`, 'warning');
                    } else {
                        showNotification(`Pré-vendas com reserva deste produto: ${reserved} unidade(s)`, 'info');
                    }
                }
            } catch {}
        })();
    };

    const addToCart = async (product, unit = null) => {
        const deduction = unit ? unit.multiplier : 1;

        // Decide stock type to use:
        // Prefer the global priceType, but if that stock is zero/insuficiente and the other type has,
        // automatically switch to the other type to avoid false "insuficiente" when Mercearia tem estoque.
        const natAvail = Number(product.stock || 0);
        const coldAvail = Number(product.coldStock || 0);
        let typeToUse = priceType;
        let isCold = typeToUse === 'cold';
        const availForType = isCold ? coldAvail : natAvail;
        if (availForType <= 0 && (coldAvail > 0 || natAvail > 0)) {
            // Switch to the type that has stock
            if (coldAvail > 0 && natAvail <= 0) {
                typeToUse = 'cold';
                isCold = true;
            } else if (natAvail > 0 && coldAvail <= 0) {
                typeToUse = 'wholesale';
                isCold = false;
            }
        }

        let coldReserved = 0;
        let natReserved = 0;
        try {
            const presales = await presalesService.getByStatus('pending');
            for (const presale of presales || []) {
                const items = Array.isArray(presale.items) ? presale.items : [];
                for (const it of items) {
                    const pid = it.productId || it.id;
                    if (pid !== product.id) continue;
                    const qty = Number(it.quantity || 0);
                    let ded = qty;
                    if (it.stockDeductionPerUnit) {
                        ded = it.stockDeductionPerUnit * qty;
                    } else if (it.unit && it.unit.multiplier) {
                        ded = it.unit.multiplier * qty;
                    }
                    if (it.isCold) coldReserved += ded; else natReserved += ded;
                }
            }
        } catch {}

        // Calculate total stock used for this product in the SAME stock type (cold/natural)
        const sameTypeCartItems = items.filter(item => item.id === product.id && ((item.isCold || false) === isCold));
        const totalStockUsedSameType = sameTypeCartItems.reduce((acc, item) => {
            const itemDeduction = item.stockDeductionPerUnit ?? (item.unit ? item.unit.multiplier : 1);
            return acc + (item.quantity * itemDeduction);
        }, 0);

        const reservedForType = isCold ? coldReserved : natReserved;
        const rawAvailableStock = isCold ? coldAvail : natAvail;
        const availableStock = Math.max(0, rawAvailableStock - reservedForType);
        const stockType = isCold ? 'Mercearia' : 'natural';

        if (totalStockUsedSameType + deduction > availableStock) {
            showNotification(`Estoque ${stockType} indisponível por reserva. Livre: ${availableStock}`, 'warning');
            return;
        }

        addItem(product, 1, unit, { itemPriceType: typeToUse });
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

        // Check if item is already in cart
        const existingItem = items.find(item => item.id === selectedProduct.id && !item.unit);
        const currentQtyInCart = existingItem ? existingItem.quantity : 0;
        const totalQty = currentQtyInCart + qty;

        // Check total stock usage for the SAME stock type (Mercearia vs natural)
        const isCold = itemPriceType === 'cold';
        const sameTypeItems = items.filter(item => item.id === selectedProduct.id && ((item.isCold || false) === isCold));
        const totalStockUsed = sameTypeItems.reduce((acc, item) => {
            const itemDeduction = item.stockDeductionPerUnit ?? (item.unit ? item.unit.multiplier : 1);
            return acc + (item.quantity * itemDeduction);
        }, 0);

        // Determine which stock to check based on itemPriceType (per-item selection)
        const rawAvailableStock = isCold ? (selectedProduct.coldStock || 0) : (selectedProduct.stock || 0);
        const reservedForType = isCold ? reservedColdCount : reservedNatCount;
        const availableStock = Math.max(0, rawAvailableStock - reservedForType);
        const stockType = isCold ? 'Mercearia' : 'natural';

        if (totalStockUsed + qty > availableStock) {
            showNotification(`Estoque ${stockType} indisponível por reserva. Livre: ${availableStock}`, 'warning');
            return;
        }

        const customPrice = typeof priceInput === 'string' ? parseFloat(String(priceInput).replace(/[^0-9.,]/g, '').replace('.', '').replace(',', '.')) : Number(priceInput);
        addItem(selectedProduct, qty, null, {
            itemPriceType,
            customPrice: !isNaN(customPrice) && customPrice > 0 ? customPrice : undefined
        });
        setQuantityModalOpen(false);
        setQuantityInput('1');
        setPriceInput('');
        showNotification('Produto adicionado!', 'success');
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 100);
    };

    const handleCheckout = () => {


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
        const amount = Number(paymentAmount);
        if (!amount || amount <= 0) {
            showNotification('Informe um valor válido', 'warning');
            return;
        }

        const totalPaid = Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
        const totalDue = Math.round(totals.total * 100) / 100;

        if (totalPaid + amount > totalDue + 1000) {
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
            const presaleData = {
                customerId: customer?.id || null,
                customerName: presaleCustomerName || 'Cliente Balcão',
                items: items.map(item => ({
                    productId: item.id || item.productId,
                    productName: item.name || item.productName || 'Produto Sem Nome',
                    quantity: Number(item.quantity) || 0,
                    unitPrice: Number(item.unitPrice) || 0,
                    discount: Number(item.discount) || 0,
                    total: Number(item.total) || 0,
                    unit: item.unit || null,
                    isCold: !!item.isCold,
                    isWholesale: !!item.isWholesale,
                    retailPrice: Number(item.retailPrice || item.unitPrice) || 0,
                    wholesalePrice: Number(item.wholesalePrice || item.unitPrice) || 0,
                    coldPrice: Number(item.coldPrice || item.unitPrice) || 0
                })),
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

            if (presaleId) {
                await presalesService.update(presaleId, cleanPresaleData);
                showNotification('Pré-venda atualizada com sucesso!', 'success');
            } else {
                await presalesService.create({ ...cleanPresaleData, reserved: false });
                showNotification('Pré-venda salva!', 'success');
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

            if (!(currentCashRegister && currentCashRegister.id)) {
                showNotification('Caixa fechado: abra o caixa para finalizar vendas', 'error');
                setProcessing(false);
                return;
            }

            if (!(isManager || isCashier)) {
                showNotification('Acesso negado: apenas gerente ou caixa pode finalizar', 'error');
                setProcessing(false);
                return;
            }

            const totals = calculateTotals();
            const totalPaid = Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
            const totalDue = Math.round(totals.total * 100) / 100;

            if (totalPaid + 0.001 < totalDue) {
                showNotification('Valor pago insuficiente', 'error');
                setProcessing(false);
                return;
            }

            const change = totalPaid - totals.total;
            const cartData = getCartData();

            

            // Verify stock
            const productMap = new Map();
            const getDeduction = (it) => {
                if (it.stockDeductionPerUnit) return it.stockDeductionPerUnit * it.quantity;
                if (it.unit && it.unit.multiplier) return it.quantity * it.unit.multiplier;
                return it.quantity;
            };
            for (const item of items) {
                if (cartData.presaleId) break; // estoque já reservado na pré-venda
                if (!item.id) continue;

                const product = await productService.getById(item.id);
                if (product) productMap.set(item.id, product);
                if (!product) {
                    showNotification(`Produto não encontrado: ${item.name}`, 'error');
                    setProcessing(false);
                    return;
                }

                const deduction = getDeduction(item);
                const available = item.isCold ? (product.coldStock || 0) : product.stock;
                if (available < deduction) {
                    const stockType = item.isCold ? 'Mercearia' : 'natural';
                    showNotification(`Estoque ${stockType} insuficiente para ${item.name}. Disponível: ${available}`, 'error');
                    setProcessing(false);
                    return;
                }
            }

            if (!currentCashRegister || !currentCashRegister.id) {
                showNotification('Erro: Nenhum caixa aberto identificado.', 'error');
                setProcessing(false);
                return;
            }

            const saleData = {
                cashRegisterId: currentCashRegister.id,
                customerId: customer?.id || null,
                customerName: customer?.name || 'Cliente Padrão',
                items: items.map(item => ({
                    productId: item.id || null,
                    productName: item.name || item.productName || productMap.get(item.id)?.name || 'Produto',
                    quantity: Number(item.quantity) || 0,
                    unitPrice: Number(item.unitPrice) || 0,
                    unitCost: Number(item.unitCost) || 0,
                    retailPrice: Number(item.retailPrice || item.unitPrice) || 0,
                    discount: Number(item.discount) || 0,
                    total: Number(item.total) || 0,
                    unit: item.unit || null,
                    isCold: !!item.isCold,
                    isWholesale: !!item.isWholesale
                })),
                subtotal: Number(totals.subtotal) || 0,
                discount: Number(totals.discount + totals.itemsDiscount) || 0,
                total: Number(totals.total) || 0,
                
                payments: payments.map(p => ({
                    method: p.method || 'Dinheiro',
                    amount: Number(p.amount) || 0
                })),
                paymentMethod: payments[0]?.method || 'Dinheiro',
                priceType: priceType || 'retail',
                totalPaid: isEditingSale ? Number((editingSale?.originalTotal || 0) + totalPaid) : Number(totalPaid) || 0,
                paymentStatus: 'paid',
                change: Number(change) || 0,
                createdBy: user?.name || 'Operador',
                cardFees: {
                    creditAmount: Number(creditPaid) || 0,
                    debitAmount: Number(debitPaid) || 0,
                    creditPercent: Number(settings?.cardCreditFee || 0) || 0,
                    debitPercent: Number(settings?.cardDebitFee || 0) || 0,
                    creditFee: Number(feeCredit) || 0,
                    debitFee: Number(feeDebit) || 0,
                    total: Number(feesTotal) || 0
                }
            };

            // Remove undefined values to prevent Firestore errors
            const cleanSaleData = JSON.parse(JSON.stringify(saleData));

            // Fast print with provisional number to avoid waiting on Firestore
            try {
                const fastSaleNumber = (() => {
                    try {
                        const d = new Date();
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        const key = `offline_counter_sales_${y}${m}${day}`;
                        const current = Number(localStorage.getItem(key) || '0') + 1;
                        localStorage.setItem(key, String(current));
                        return `OFF-${y}${m}${day}-${current}`;
                    } catch {
                        return String(Date.now());
                    }
                })();
                const previewSale = { ...cleanSaleData, saleNumber: fastSaleNumber, provisional: true };
                printReceipt(previewSale, { ...settings, silentPrint: true });
                setPaymentModalOpen(false);
            } catch (e) {}

            let sale;
            if (isEditingSale) {
                await salesService.update(editingSale.id, { ...cleanSaleData, status: 'modified' });
                sale = { id: editingSale.id, ...cleanSaleData };
            } else {
                if (cartData.presaleId) {
                    sale = await presalesService.finalizeToSaleTxn(cartData.presaleId, cleanSaleData, user?.name || 'Operador');
                } else {
                    sale = await salesService.create(cleanSaleData);
                }
            }

            const runPostTasks = async () => {
                try {
                    if (change > 0) {
                        try {
                            await cashRegisterService.addMovement({
                                cashRegisterId: currentCashRegister.id,
                                type: 'change',
                                amount: change,
                                description: `Troco da venda #${sale.saleNumber}`,
                                createdBy: user?.name || 'Sistema'
                            });
                        } catch (error) {
                            console.error('Error registering change:', error);
                        }
                    }
    
                    if (!cartData.presaleId) {
                        const updatesByProduct = new Map();
                        for (const item of items) {
                            if (!item.id) continue;
                            const d = getDeduction(item);
                            const entry = updatesByProduct.get(item.id) || { cold: 0, nat: 0, name: item.name };
                            if (item.isCold) entry.cold += d; else entry.nat += d;
                            updatesByProduct.set(item.id, entry);
                        }
                        const tasks = Array.from(updatesByProduct.entries()).map(async ([pid, entry]) => {
                            try {
                                const product = await productService.getById(pid);
                                if (!product) return;
                                const update = {};
                                if (entry.cold > 0) {
                                    const newColdStock = (product.coldStock || 0) - entry.cold;
                                    update.coldStock = Math.max(0, newColdStock);
                                }
                                if (entry.nat > 0) {
                                    const newStock = (product.stock || 0) - entry.nat;
                                    update.stock = Math.max(0, newStock);
                                }
                                if (Object.keys(update).length > 0) {
                                    await productService.update(product.id, update);
                                }
                            } catch (stockError) {
                                console.error('Error updating stock for product:', entry.name, stockError);
                            }
                        });
                        await Promise.allSettled(tasks);
                    }
                } catch (e) {
                    console.error('Post-finalization tasks error:', e);
                }
            };
            runPostTasks().catch(() => {});

            

            showNotification('Venda realizada com sucesso!', 'success');
            clearCart();
            setPaymentModalOpen(false);
            setPayments([]);
            setSearchTerm('');

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
                                                transition: 'all var(--transition-fast)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                background: index === selectedIndex ? 'var(--color-bg-hover)' : 'transparent',
                                                borderRadius: 'var(--radius-md)',
                                                boxShadow: index === selectedIndex ? 'var(--shadow-md)' : 'var(--shadow-sm)'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (index !== selectedIndex) e.currentTarget.style.background = 'var(--color-bg-hover)';
                                                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                            }}
                                            onMouseLeave={(e) => {
                                                if (index !== selectedIndex) e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.boxShadow = index === selectedIndex ? 'var(--shadow-md)' : 'var(--shadow-sm)';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                            }}
                                        >
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{product.name}</div>
                                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                                {product.barcode || 'Sem código'} | Atacado: {product.stock ?? 0} | Mercearia: {product.coldStock ?? 0}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                                                Atacado: {formatCurrency(product.wholesalePrice || product.price)}
                                            </div>
                                            <div style={{ fontWeight: 600, color: '#3b82f6' }}>
                                                Mercearia: {formatCurrency(product.coldPrice || product.price)}
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
                                        <div key={`${item.id}-${item.unit?.name || 'base'}-${item.isCold ? 'cold' : 'nat'}`} style={{
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
                            {feesTotal > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--spacing-xs)' }}>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Taxa de Cartão</span>
                                    <span style={{ color: 'var(--color-danger)' }}>{formatCurrency(feesTotal)}</span>
                                </div>
                            )}
                            {feesTotal > 0 && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginTop: 'var(--spacing-xs)',
                                    borderTop: '1px dashed var(--color-border)',
                                    paddingTop: 'var(--spacing-xs)',
                                    fontWeight: 600
                                }}>
                                    <span>Líquido</span>
                                    <span>{formatCurrency(Math.max(0, totals.total - feesTotal))}</span>
                                </div>
                            )}
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
                                disabled={items.length === 0 || !canCheckout}
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
                size="sm"
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
                                atacadoBtnRef.current?.focus();
                            }
                        }}
                        autoFocus
                    />
                    <div>
                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>
                            Tipo de Preço (por item)
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <Button
                                ref={atacadoBtnRef}
                                variant={itemPriceType === 'wholesale' ? 'primary' : 'secondary'}
                                onClick={() => {
                                    setItemPriceType('wholesale');
                                    if (selectedProduct) setPriceInput(selectedProduct.wholesalePrice || selectedProduct.price);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setItemPriceType('wholesale');
                                        if (selectedProduct) setPriceInput(selectedProduct.wholesalePrice || selectedProduct.price);
                                        priceInputRef.current?.focus();
                                    } else if (e.key === 'ArrowRight') {
                                        setItemPriceType('cold');
                                        if (selectedProduct) setPriceInput(selectedProduct.coldPrice || selectedProduct.price);
                                        geladaBtnRef.current?.focus();
                                    } else if (e.key === 'ArrowLeft') {
                                        setItemPriceType('wholesale');
                                        if (selectedProduct) setPriceInput(selectedProduct.wholesalePrice || selectedProduct.price);
                                    }
                                }}
                            >
                                Atacado
                            </Button>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Estoque: <strong>{selectedProduct?.stock ?? 0}</strong></span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <Button
                                ref={geladaBtnRef}
                                variant={itemPriceType === 'cold' ? 'primary' : 'secondary'}
                                onClick={() => {
                                    setItemPriceType('cold');
                                    if (selectedProduct) setPriceInput(selectedProduct.coldPrice || selectedProduct.price);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setItemPriceType('cold');
                                        if (selectedProduct) setPriceInput(selectedProduct.coldPrice || selectedProduct.price);
                                        priceInputRef.current?.focus();
                                    } else if (e.key === 'ArrowLeft') {
                                        setItemPriceType('wholesale');
                                        if (selectedProduct) setPriceInput(selectedProduct.wholesalePrice || selectedProduct.price);
                                        atacadoBtnRef.current?.focus();
                                    } else if (e.key === 'ArrowRight') {
                                        setItemPriceType('cold');
                                        if (selectedProduct) setPriceInput(selectedProduct.coldPrice || selectedProduct.price);
                                        geladaBtnRef.current?.focus();
                                    }
                                }}
                            >
                                Mercearia
                            </Button>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Estoque: <strong>{selectedProduct?.coldStock ?? 0}</strong></span>
                            </div>
                        </div>
                        {reservedCount > 0 && (
                            <div style={{ marginTop: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)' }}>
                                Reservado em pré-vendas: <strong>{reservedCount}</strong>
                            </div>
                        )}
                    </div>
                    <CurrencyInput
                        ref={priceInputRef}
                        label="Preço (opcional)"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmQuantity(); }}
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
                                !canCheckout ||
                                processing ||
                                (isEditingSale
                                    ? ((Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100) + 0.001 < Math.max(0, Math.round((totals.total - (editingSale?.originalTotal || 0)) * 100) / 100))
                                    : ((Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100) + 0.001 < Math.round(totals.total * 100) / 100)
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
