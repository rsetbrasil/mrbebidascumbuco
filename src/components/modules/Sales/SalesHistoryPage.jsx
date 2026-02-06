import React, { useState, useEffect, useRef } from 'react';
import { Search, XCircle, Eye, Printer } from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import DateInput from '../../common/DateInput';
import Loading from '../../common/Loading';
import Notification from '../../common/Notification';
import { salesService, productService, cashRegisterService, firestoreService, COLLECTIONS } from '../../../services/firestore';
import { formatCurrency, formatDate, formatDateTime, formatPercentage } from '../../../utils/formatters';
import { printReceipt, printSalesDayReport } from '../../../utils/receiptPrinter';
import { useApp } from '../../../contexts/AppContext';
import { useCart } from '../../../contexts/CartContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Modal from '../../common/Modal';

const SalesHistoryPage = () => {
    const { canWrite } = useAuth();
    const { settings } = useApp();
    const { loadSale } = useCart();
    const navigate = useNavigate();
    const [sales, setSales] = useState([]);
    const [pageLoading, setPageLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [notification, setNotification] = useState(null);
    const [selectedSale, setSelectedSale] = useState(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportData, setReportData] = useState(null);

    // Date filter states - default to today
    const getDefaultDateStr = () => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };
    const [startDate, setStartDate] = useState(getDefaultDateStr);
    const [endDate, setEndDate] = useState(getDefaultDateStr);

    const [editing, setEditing] = useState(false);
    const [addSearch, setAddSearch] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const firstLoadRef = useRef(true);

    const toLocalIsoDate = (date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };

    const handleToday = () => {
        const todayStr = toLocalIsoDate(new Date());
        setStartDate(todayStr);
        setEndDate(todayStr);
    };

    const handleYesterday = () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const yesterdayStr = toLocalIsoDate(d);
        setStartDate(yesterdayStr);
        setEndDate(yesterdayStr);
    };

    const handleLastNDays = (days) => {
        const endStr = toLocalIsoDate(new Date());
        const d = new Date();
        d.setDate(d.getDate() - Number(days));
        const startStr = toLocalIsoDate(d);
        setStartDate(startStr);
        setEndDate(endStr);
    };

    useEffect(() => {
        if (firstLoadRef.current) {
            setPageLoading(true);
        } else {
            setDataLoading(true);
        }

        // Construct date objects in local time
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59.999');

        const unsub = salesService.subscribeByDateRange((data) => {
            setSales(data);
            if (firstLoadRef.current) {
                setPageLoading(false);
                firstLoadRef.current = false;
            }
            setDataLoading(false);
        }, start, end);

        return () => { try { unsub && unsub(); } catch { } };
    }, [startDate, endDate]);

    const loadSales = async () => { };

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const normalizePayments = (sale) => {
        if (Array.isArray(sale?.payments) && sale.payments.length > 0) {
            return sale.payments.map(p => ({
                method: p.method || 'Dinheiro',
                amount: Number(p.amount || 0)
            }));
        }
        return [{
            method: sale?.paymentMethod || 'Dinheiro',
            amount: Number(sale?.total || 0)
        }];
    };

    const getSaleTypeLabel = (sale) => {
        const items = Array.isArray(sale.items) ? sale.items : [];
        const hasCold = items.some(it => it && it.isCold);
        const hasWarm = items.some(it => it && !it.isCold);
        if (hasCold && hasWarm) return 'Atacado + Mercearia';
        return hasCold ? 'Mercearia' : 'Atacado';
    };

    const handlePrint = async (sale) => {
        try {
            const nameMap = {};
            const items = Array.isArray(sale.items) ? [...sale.items] : [];
            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                const existing = it.productName || it.name;
                const missing = !existing || existing === 'Produto Sem Nome' || existing === 'Item';
                if (!missing && it.productId) {
                    nameMap[it.productId] = existing;
                } else if (it.productId) {
                    const p = await productService.getById(it.productId);
                    if (p && p.name) {
                        nameMap[it.productId] = p.name;
                        items[i] = { ...it, productName: p.name };
                    }
                }
            }
            const enriched = { ...sale, items, _productNames: nameMap };
            printReceipt(enriched, settings);
        } catch (e) {
            printReceipt(sale, settings);
        }
    };

    const handlePrintSalesReport = async () => {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59.999');
        if (!Array.isArray(sales) || sales.length === 0) {
            showNotification('warning', 'Nenhuma venda no período selecionado');
            return;
        }
        const costByKey = new Map();
        const enrichItem = async (item) => {
            if (!item || !item.productId) return item;
            const isCold = !!item.isCold;
            const unitMultiplier = item.unit && item.unit.multiplier ? Number(item.unit.multiplier) : 1;
            const cacheKey = `${String(item.productId)}|${isCold ? 'cold' : 'wholesale'}|${unitMultiplier}`;
            if (costByKey.has(cacheKey)) return { ...item, unitCost: costByKey.get(cacheKey) };

            try {
                const product = await productService.getById(String(item.productId));
                const rawCost = Number(isCold ? (product?.coldCost || product?.cost || 0) : (product?.cost || 0));
                const costUnitMultiplier = Number(isCold ? (product?.coldUnitMultiplier || 1) : (product?.wholesaleUnitMultiplier || 1));
                const baseCost = costUnitMultiplier > 0 ? (rawCost / costUnitMultiplier) : rawCost;
                const computedUnitCost = baseCost * unitMultiplier;
                costByKey.set(cacheKey, computedUnitCost);
                return { ...item, unitCost: computedUnitCost };
            } catch {
                costByKey.set(cacheKey, Number(item.unitCost || 0));
                return item;
            }
        };

        const enrichedSales = await Promise.all(
            sales.map(async (sale) => {
                const items = Array.isArray(sale?.items) ? sale.items : [];
                if (items.length === 0) return sale;
                const enrichedItems = await Promise.all(items.map(enrichItem));
                return { ...sale, items: enrichedItems };
            })
        );

        printSalesDayReport({ sales: enrichedSales, start, end }, settings);
    };

    const handleViewSalesReport = async () => {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59.999');
        setReportModalOpen(true);
        setReportLoading(true);
        setReportData(null);
        try {
            if (!Array.isArray(sales) || sales.length === 0) {
                setReportData({
                    start,
                    end,
                    totals: {
                        salesCount: 0,
                        itemsCount: 0,
                        totalSales: 0,
                        totalCMV: 0,
                        profit: 0,
                        margin: 0
                    },
                    byPayment: [],
                    byType: {
                        atacado: { revenue: 0, cost: 0, profit: 0 },
                        mercearia: { revenue: 0, cost: 0, profit: 0 },
                        total: { revenue: 0, cost: 0, profit: 0 }
                    }
                });
                return;
            }

            const costByKey = new Map();
            const enrichItem = async (sale, item) => {
                if (!item || !item.productId) return item;
                const computedIsCold = (item.isCold !== undefined) ? !!item.isCold : (sale?.priceType === 'cold');
                const unitMultiplier = item.unit && item.unit.multiplier ? Number(item.unit.multiplier) : 1;
                const cacheKey = `${String(item.productId)}|${computedIsCold ? 'cold' : 'wholesale'}|${unitMultiplier}`;
                if (costByKey.has(cacheKey)) return { ...item, unitCost: costByKey.get(cacheKey) };
                try {
                    const product = await productService.getById(String(item.productId));
                    const rawCost = Number(computedIsCold ? (product?.coldCost || product?.cost || 0) : (product?.cost || 0));
                    const costUnitMultiplier = Number(computedIsCold ? (product?.coldUnitMultiplier || 1) : (product?.wholesaleUnitMultiplier || 1));
                    const baseCost = costUnitMultiplier > 0 ? (rawCost / costUnitMultiplier) : rawCost;
                    const computedUnitCost = baseCost * unitMultiplier;
                    costByKey.set(cacheKey, computedUnitCost);
                    return { ...item, unitCost: computedUnitCost, isCold: computedIsCold };
                } catch {
                    const fallback = Number(item.unitCost || 0);
                    costByKey.set(cacheKey, fallback);
                    return { ...item, isCold: computedIsCold };
                }
            };

            const enrichedSales = await Promise.all(
                sales.map(async (sale) => {
                    const items = Array.isArray(sale?.items) ? sale.items : [];
                    if (items.length === 0) return sale;
                    const enrichedItems = await Promise.all(items.map(it => enrichItem(sale, it)));
                    return { ...sale, items: enrichedItems };
                })
            );

            const paymentsMap = new Map();
            for (const sale of enrichedSales) {
                const list = normalizePayments(sale);
                for (const p of list) {
                    const key = String(p.method || 'Dinheiro');
                    const prev = paymentsMap.get(key) || { amount: 0, count: 0 };
                    paymentsMap.set(key, { amount: prev.amount + Number(p.amount || 0), count: prev.count + 1 });
                }
            }
            const byPayment = Array.from(paymentsMap.entries()).map(([method, v]) => ({ method, amount: v.amount, count: v.count }));

            let itemsCount = 0;
            let totalSales = 0;
            let totalCMV = 0;
            const byType = {
                atacado: { revenue: 0, cost: 0, profit: 0 },
                mercearia: { revenue: 0, cost: 0, profit: 0 },
                total: { revenue: 0, cost: 0, profit: 0 }
            };

            for (const sale of enrichedSales) {
                const items = Array.isArray(sale?.items) ? sale.items : [];
                for (const item of items) {
                    itemsCount += 1;
                    const qty = Number(item?.quantity || 0);
                    const unitPrice = Number(item?.unitPrice || 0);
                    const unitCost = Number(item?.unitCost || 0);
                    const discount = Number(item?.discount || 0);
                    const revenue = Number(item?.total);
                    const lineRevenue = Number.isFinite(revenue) ? revenue : (qty * unitPrice) - discount;
                    const lineCost = qty * unitCost;
                    const isCold = !!item?.isCold;
                    if (isCold) {
                        byType.mercearia.revenue += lineRevenue;
                        byType.mercearia.cost += lineCost;
                    } else {
                        byType.atacado.revenue += lineRevenue;
                        byType.atacado.cost += lineCost;
                    }
                }
            }

            totalSales = enrichedSales.reduce((sum, s) => sum + Number(s?.total || 0), 0);
            totalCMV = byType.atacado.cost + byType.mercearia.cost;
            byType.atacado.profit = byType.atacado.revenue - byType.atacado.cost;
            byType.mercearia.profit = byType.mercearia.revenue - byType.mercearia.cost;
            byType.total.revenue = byType.atacado.revenue + byType.mercearia.revenue;
            byType.total.cost = byType.atacado.cost + byType.mercearia.cost;
            byType.total.profit = byType.total.revenue - byType.total.cost;

            const profit = totalSales - totalCMV;
            const margin = totalSales > 0 ? (profit / totalSales) : 0;

            setReportData({
                start,
                end,
                totals: {
                    salesCount: enrichedSales.length,
                    itemsCount,
                    totalSales,
                    totalCMV,
                    profit,
                    margin
                },
                byPayment,
                byType
            });
        } catch (e) {
            setReportData(null);
            showNotification('error', 'Erro ao gerar relatório');
        } finally {
            setReportLoading(false);
        }
    };

    const handleViewSale = (sale) => {
        setSelectedSale(sale);
        setDetailsModalOpen(true);
    };

    const handleCancelSale = async (sale) => {
        if (!window.confirm(`Tem certeza que deseja cancelar a venda #${sale.saleNumber}? Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            for (const item of sale.items || []) {
                const productId = item.productId;
                if (!productId) continue;
                const product = await productService.getById(productId);
                if (!product) continue;

                const deduction = Number(item.stockDeduction || (item.unit && item.unit.multiplier ? (Number(item.quantity) || 0) * item.unit.multiplier : Number(item.quantity) || 0));
                if (item.isCold) {
                    const newColdStock = Number(product.coldStock || 0) + deduction;
                    await productService.update(product.id, { coldStock: newColdStock });
                } else {
                    const newStock = Number(product.stock || 0) + deduction;
                    await productService.update(product.id, { stock: newStock });
                }
            }

            const refundAmount = Number(sale.totalPaid || sale.total || 0);
            if (sale.cashRegisterId && refundAmount > 0) {
                try {
                    await cashRegisterService.addMovement({
                        cashRegisterId: sale.cashRegisterId,
                        type: 'refund',
                        amount: refundAmount,
                        description: `Estorno venda #${sale.saleNumber}`,
                        createdBy: 'Sistema'
                    });
                } catch { }
                try {
                    const movements = await cashRegisterService.getMovements(sale.cashRegisterId);
                    const relatedChange = (movements || []).filter(m =>
                        m.type === 'change' &&
                        String(m.description || '').includes(`#${sale.saleNumber}`)
                    );
                    await Promise.all(
                        relatedChange.map(m => firestoreService.delete(COLLECTIONS.CASH_MOVEMENTS, m.id))
                    );
                } catch { }
            }

            await firestoreService.delete(COLLECTIONS.SALES, sale.id);
            showNotification('success', `Venda #${sale.saleNumber} cancelada, estoque restaurado e pagamento estornado`);
            await loadSales();
        } catch (error) {
            console.error('Error cancelling sale:', error);
            showNotification('error', 'Erro ao cancelar venda');
        }
    };

    const restoreStockForItem = async (sale, item) => {
        try {
            const product = await productService.getById(item.productId);
            if (!product) return;
            const deduction = Number(item.stockDeduction || (item.unit && item.unit.multiplier ? (Number(item.quantity) || 0) * item.unit.multiplier : Number(item.quantity) || 0));
            if (item.isCold) {
                const newColdStock = Number(product.coldStock || 0) + deduction;
                await productService.update(product.id, { coldStock: newColdStock });
            } else {
                const newStock = Number(product.stock || 0) + deduction;
                await productService.update(product.id, { stock: newStock });
            }
        } catch (e) {
            console.error('Error restoring stock:', e);
        }
    };

    const deductStockForProduct = async (sale, productId, deduction) => {
        const product = await productService.getById(productId);
        if (!product) return true; // não bloquear
        if (sale.priceType === 'cold') {
            const available = Number(product.coldStock || 0);
            const next = Math.max(0, available - Number(deduction || 0));
            await productService.update(product.id, { coldStock: next });
        } else {
            const available = Number(product.stock || 0);
            const next = Math.max(0, available - Number(deduction || 0));
            await productService.update(product.id, { stock: next });
        }
        return true;
    };

    const handleRemoveItem = async (index) => {
        if (!selectedSale) return;
        const item = selectedSale.items[index];
        await restoreStockForItem(selectedSale, item);

        const newItems = selectedSale.items.filter((_, i) => i !== index);
        const newSubtotal = newItems.reduce((sum, it) => sum + (it.quantity * it.unitPrice), 0);
        const newItemsDiscount = newItems.reduce((sum, it) => sum + (it.discount || 0), 0);
        const newTotal = Math.max(0, newSubtotal - newItemsDiscount - (selectedSale.discount || 0));

        await salesService.update(selectedSale.id, { items: newItems, subtotal: newSubtotal, total: newTotal, status: 'modified' });
        setSelectedSale({ ...selectedSale, items: newItems, subtotal: newSubtotal, total: newTotal, status: 'modified' });
        showNotification('success', 'Item cancelado e estoque restaurado');
        await loadSales();
    };

    const handleAddItem = async () => {
        if (!selectedSale || !addSearch) return;
        try {
            let product = null;
            // First try exact barcode match
            const numericLike = addSearch.replace(/\D/g, '');
            if (numericLike && numericLike.length >= 4) {
                product = await productService.getByBarcode(addSearch);
            }
            // Fallback to text search
            if (!product) {
                const candidates = await productService.search(addSearch);
                product = candidates && candidates.length > 0 ? candidates[0] : null;
            }
            if (!product) {
                showNotification('warning', 'Produto não encontrado');
                return;
            }

            const quantity = 1;
            const wholesaleCandidate = product.wholesalePrice === null ? null : (product.wholesalePrice ?? product.price);
            const coldCandidate = product.coldPrice === null ? null : (product.coldPrice ?? product.price);
            const unitPrice = selectedSale.priceType === 'wholesale'
                ? wholesaleCandidate
                : (selectedSale.priceType === 'cold'
                    ? coldCandidate
                    : (product.price ?? null));
            if (unitPrice === null || unitPrice === undefined) {
                showNotification('warning', 'Produto sem preço para este tipo de venda');
                return;
            }
            const deduction = 1; // base unit
            const ok = await deductStockForProduct(selectedSale, product.id, deduction);
            if (!ok) {
                showNotification('warning', 'Estoque insuficiente para adicionar');
                return;
            }

            const newItem = {
                productId: product.id,
                productName: product.name,
                quantity,
                unitPrice,
                unitCost: product.cost || 0,
                discount: 0,
                total: quantity * unitPrice
            };

            const newItems = [...(selectedSale.items || []), newItem];
            const newSubtotal = newItems.reduce((sum, it) => sum + (it.quantity * it.unitPrice), 0);
            const newItemsDiscount = newItems.reduce((sum, it) => sum + (it.discount || 0), 0);
            const newTotal = Math.max(0, newSubtotal - newItemsDiscount - (selectedSale.discount || 0));

            await salesService.update(selectedSale.id, { items: newItems, subtotal: newSubtotal, total: newTotal, status: 'modified' });
            setSelectedSale({ ...selectedSale, items: newItems, subtotal: newSubtotal, total: newTotal, status: 'modified' });
            setAddSearch('');
            showNotification('success', 'Item adicionado à venda');
            await loadSales();
        } catch (error) {
            console.error('Error adding item:', error);
            showNotification('error', 'Erro ao adicionar item');
        }
    };

    const handleAddItemFromSuggestion = async (product) => {
        if (!selectedSale || !product) return;
        try {
            const quantity = 1;
            const wholesaleCandidate = product.wholesalePrice === null ? null : (product.wholesalePrice ?? product.price);
            const coldCandidate = product.coldPrice === null ? null : (product.coldPrice ?? product.price);
            const unitPrice = selectedSale.priceType === 'wholesale'
                ? wholesaleCandidate
                : (selectedSale.priceType === 'cold'
                    ? coldCandidate
                    : (product.price ?? null));
            if (unitPrice === null || unitPrice === undefined) {
                showNotification('warning', 'Produto sem preço para este tipo de venda');
                return;
            }
            const deduction = 1;
            const ok = await deductStockForProduct(selectedSale, product.id, deduction);
            if (!ok) {
                showNotification('warning', 'Estoque insuficiente para adicionar');
                return;
            }

            const newItem = {
                productId: product.id,
                productName: product.name,
                quantity,
                unitPrice,
                unitCost: product.cost || 0,
                discount: 0,
                total: quantity * unitPrice
            };

            const newItems = [...(selectedSale.items || []), newItem];
            const newSubtotal = newItems.reduce((sum, it) => sum + (it.quantity * it.unitPrice), 0);
            const newItemsDiscount = newItems.reduce((sum, it) => sum + (it.discount || 0), 0);
            const newTotal = Math.max(0, newSubtotal - newItemsDiscount - (selectedSale.discount || 0));

            await salesService.update(selectedSale.id, { items: newItems, subtotal: newSubtotal, total: newTotal, status: 'modified' });
            setSelectedSale({ ...selectedSale, items: newItems, subtotal: newSubtotal, total: newTotal, status: 'modified' });
            setAddSearch('');
            setSuggestions([]);
            setSuggestionsOpen(false);
            setHighlightIndex(-1);
            showNotification('success', 'Item adicionado à venda');
            await loadSales();
        } catch (error) {
            console.error('Error adding item from suggestion:', error);
            showNotification('error', 'Erro ao adicionar item');
        }
    };

    const updateSuggestions = async (term) => {
        if (!term || term.trim().length < 2) {
            setSuggestions([]);
            setSuggestionsOpen(false);
            setHighlightIndex(-1);
            return;
        }
        try {
            const results = await productService.search(term);
            let list = results || [];
            // If numeric-like, attempt exact barcode and put first
            const numericLike = term.replace(/\D/g, '');
            if (numericLike && numericLike.length >= 4) {
                const byBarcode = await productService.getByBarcode(term);
                if (byBarcode) {
                    list = [byBarcode, ...list.filter(p => p.id !== byBarcode.id)];
                }
            }
            setSuggestions(list.slice(0, 6));
            setSuggestionsOpen(list.length > 0);
            setHighlightIndex(list.length > 0 ? 0 : -1);
        } catch (e) {
            console.error('Error fetching suggestions:', e);
            setSuggestions([]);
            setSuggestionsOpen(false);
            setHighlightIndex(-1);
        }
    };

    const parseNumber = (txt) => {
        const s = String(txt).replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    };
    const term = searchTerm.trim();
    const rangeMatch = term.match(/^([\d.,]+)\s*-\s*([\d.,]+)$/);
    const opMatch = term.match(/^(>=|<=|>|<|=)?\s*([\d.,]+)$/);

    const [filterPayment, setFilterPayment] = useState('all');
    const [filterType, setFilterType] = useState('all');

    // ... existing date logic ...

    // Helper to extract unique payment methods from current sales for the dropdown
    const paymentMethods = React.useMemo(() => {
        const methods = new Set();
        sales.forEach(s => {
            if (s.paymentMethod) methods.add(s.paymentMethod);
            if (Array.isArray(s.payments)) s.payments.forEach(p => methods.add(p.method));
        });
        return Array.from(methods).sort();
    }, [sales]);

    const filteredSales = (sales || [])
        .filter((sale) => {
            // Text Search
            const textMatch =
                sale.saleNumber?.toLowerCase().includes(term.toLowerCase()) ||
                sale.customerName?.toLowerCase().includes(term.toLowerCase());

            // Allow searching by exact value or range even if text doesn't match name/number
            const total = Number(sale.total || 0);
            let matchesSearch = textMatch;

            if (!matchesSearch && term) {
                if (rangeMatch) {
                    const a = parseNumber(rangeMatch[1]);
                    const b = parseNumber(rangeMatch[2]);
                    if (a != null && b != null) {
                        const min = Math.min(a, b), max = Math.max(a, b);
                        matchesSearch = total >= min && total <= max;
                    }
                } else if (opMatch) {
                    const op = opMatch[1] || '=';
                    const val = parseNumber(opMatch[2]);
                    if (val != null) {
                        if (op === '>') matchesSearch = total > val;
                        else if (op === '>=') matchesSearch = total >= val;
                        else if (op === '<') matchesSearch = total < val;
                        else if (op === '<=') matchesSearch = total <= val;
                        else matchesSearch = Math.abs(total - val) < 0.005;
                    }
                } else {
                    const numeric = parseNumber(term);
                    if (numeric != null) {
                        matchesSearch = Math.abs(total - numeric) < 0.005;
                    }
                }
            }

            if (term && !matchesSearch) return false;

            // Payment Filter
            if (filterPayment !== 'all') {
                const mainMethod = sale.paymentMethod;
                const subMethods = Array.isArray(sale.payments) ? sale.payments.map(p => p.method) : [];
                if (mainMethod !== filterPayment && !subMethods.includes(filterPayment)) {
                    return false;
                }
            }

            // Type Filter
            if (filterType !== 'all') {
                const typeLabel = getSaleTypeLabel(sale);
                if (filterType === 'Atacado' && typeLabel !== 'Atacado') return false;
                if (filterType === 'Mercearia' && typeLabel !== 'Mercearia') return false;
                if (filterType === 'Misto' && typeLabel !== 'Atacado + Mercearia') return false;
            }

            return true;
        })
        .sort((a, b) => {
            const av = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
            const bv = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
            return bv - av;
        });

    if (pageLoading) return <Loading fullScreen />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {notification && (
                <Notification
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--spacing-md)'
            }}>
                <div>
                    <h1 style={{
                        fontSize: 'var(--font-size-2xl)',
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        marginBottom: 'var(--spacing-xs)'
                    }}>Histórico de Vendas</h1>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Visualize e gerencie todas as vendas realizadas</p>
                </div>
            </div>

            <Card>
                <div style={{
                    padding: 'var(--spacing-md)',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-md)'
                }}>
                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                        <div style={{ flex: 2, minWidth: '300px' }}>
                            <Input
                                placeholder="Buscar por número, cliente ou valor..."
                                icon={Search}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="no-margin"
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                            <select
                                className="input"
                                value={filterPayment}
                                onChange={(e) => setFilterPayment(e.target.value)}
                                style={{ height: '48px', cursor: 'pointer' }}
                            >
                                <option value="all">Forma de Pagto. (Todas)</option>
                                {paymentMethods.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                            <select
                                className="input"
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                style={{ height: '48px', cursor: 'pointer' }}
                            >
                                <option value="all">Tipo de Venda (Todos)</option>
                                <option value="Atacado">Atacado</option>
                                <option value="Mercearia">Mercearia</option>
                                <option value="Misto">Misto</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                            <DateInput value={startDate} onChange={setStartDate} labelPrefix="De" style={{ minWidth: 130 }} />
                            <DateInput value={endDate} onChange={setEndDate} labelPrefix="Até" style={{ minWidth: 130 }} />
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                            <Button variant="secondary" size="sm" onClick={handleToday}>Hoje</Button>
                            <Button variant="secondary" size="sm" onClick={handleYesterday}>Ontem</Button>
                            <Button variant="secondary" size="sm" onClick={() => handleLastNDays(30)}>30D</Button>
                            <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 8px' }}></div>
                            <Button variant="secondary" size="sm" onClick={handleViewSalesReport} icon={Eye}>Ver Relatório</Button>
                            <Button variant="secondary" size="sm" onClick={handlePrintSalesReport} icon={Printer}>Imprimir</Button>
                            {dataLoading && (
                                <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginLeft: '8px' }}>
                                    Atualizando...
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Número</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Data</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Cliente</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Itens</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Total</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Tipo</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Pagamento</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600, textAlign: 'right' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        Nenhuma venda encontrada
                                    </td>
                                </tr>
                            ) : (
                                filteredSales.map((sale) => (
                                    <tr key={sale.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                                        <td style={{ padding: 'var(--spacing-md)', fontWeight: 500 }}>
                                            #{sale.saleNumber}
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
                                            {formatDateTime(sale.createdAt)}
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)' }}>
                                            {sale.customerName || 'Cliente Balcão'}
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
                                            {sale.items?.length || 0} itens
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)', fontWeight: 600, color: 'var(--color-success)' }}>
                                            {formatCurrency(sale.total)}
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                background: 'var(--color-bg-secondary)',
                                                color: 'var(--color-text-secondary)',
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: 500,
                                                border: '1px solid var(--color-border)'
                                            }}>
                                                {getSaleTypeLabel(sale)}
                                            </span>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                background: 'var(--color-bg-secondary)',
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: 500
                                            }}>
                                                {sale.paymentMethod}
                                            </span>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
                                                <button
                                                    onClick={() => handleViewSale(sale)}
                                                    style={{
                                                        padding: '6px',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'var(--color-primary)',
                                                        cursor: 'pointer',
                                                        borderRadius: 'var(--radius-md)'
                                                    }}
                                                    title="Ver Detalhes"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handlePrint(sale)}
                                                    style={{
                                                        padding: '6px',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'var(--color-text-secondary)',
                                                        cursor: 'pointer',
                                                        borderRadius: 'var(--radius-md)'
                                                    }}
                                                    title="Imprimir Comprovante"
                                                >
                                                    <Printer size={18} />
                                                </button>
                                                {canWrite && (
                                                    <button
                                                        onClick={() => handleCancelSale(sale)}
                                                        style={{
                                                            padding: '6px',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: 'var(--color-danger)',
                                                            cursor: 'pointer',
                                                            borderRadius: 'var(--radius-md)'
                                                        }}
                                                        title="Cancelar Venda"
                                                    >
                                                        <XCircle size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal
                isOpen={reportModalOpen}
                onClose={() => setReportModalOpen(false)}
                title={`Relatório de Vendas (${formatDate(startDate)} - ${formatDate(endDate)})`}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <Button
                            variant="secondary"
                            onClick={() => setReportModalOpen(false)}
                        >
                            Fechar
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handlePrintSalesReport}
                            icon={Printer}
                            disabled={reportLoading}
                        >
                            Imprimir
                        </Button>
                    </div>
                }
            >
                {reportLoading ? (
                    <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        Gerando relatório...
                    </div>
                ) : !reportData ? (
                    <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        Não foi possível gerar o relatório.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: 'var(--spacing-md)',
                            padding: 'var(--spacing-md)',
                            background: 'var(--color-bg-secondary)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Vendas</div>
                                <div style={{ fontWeight: 700 }}>{reportData.totals.salesCount}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Itens</div>
                                <div style={{ fontWeight: 700 }}>{reportData.totals.itemsCount}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Faturamento</div>
                                <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>{formatCurrency(reportData.totals.totalSales)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>CMV</div>
                                <div style={{ fontWeight: 700 }}>{formatCurrency(reportData.totals.totalCMV)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Lucro</div>
                                <div style={{ fontWeight: 700 }}>{formatCurrency(reportData.totals.profit)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Margem</div>
                                <div style={{ fontWeight: 700 }}>{formatPercentage(reportData.totals.margin)}</div>
                            </div>
                        </div>

                        <div style={{
                            padding: 'var(--spacing-md)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <div style={{ fontWeight: 700, marginBottom: 'var(--spacing-sm)' }}>Por tipo</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Atacado (Lucro)</span>
                                    <span style={{ fontWeight: 700 }}>{formatCurrency(reportData.byType.atacado.profit)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Mercearia (Lucro)</span>
                                    <span style={{ fontWeight: 700 }}>{formatCurrency(reportData.byType.mercearia.profit)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Total (Lucro)</span>
                                    <span style={{ fontWeight: 700 }}>{formatCurrency(reportData.byType.total.profit)}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            padding: 'var(--spacing-md)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <div style={{ fontWeight: 700, marginBottom: 'var(--spacing-sm)' }}>Por forma de pagamento</div>
                            {reportData.byPayment.length === 0 ? (
                                <div style={{ color: 'var(--color-text-secondary)' }}>-</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {reportData.byPayment.map((p) => (
                                        <div key={p.method} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>{p.method}</span>
                                            <span style={{ fontWeight: 700 }}>{formatCurrency(p.amount)}{p.count ? ` (${p.count})` : ''}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Sale Details Modal */}
            <Modal
                isOpen={detailsModalOpen}
                onClose={() => setDetailsModalOpen(false)}
                title={`Detalhes da Venda #${selectedSale?.saleNumber || ''}`}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        {canWrite && (
                            <Button variant="primary" onClick={() => { loadSale(selectedSale); setDetailsModalOpen(false); navigate('/sales'); }}>
                                Editar no PDV
                            </Button>
                        )}
                        <Button variant="secondary" onClick={() => setDetailsModalOpen(false)}>
                            Fechar
                        </Button>
                    </div>
                }
            >
                {selectedSale && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                        {/* Header Info */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 'var(--spacing-md)',
                            padding: 'var(--spacing-md)',
                            background: 'var(--color-bg-secondary)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Data</div>
                                <div style={{ fontWeight: 500 }}>{formatDateTime(selectedSale.createdAt)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Cliente</div>
                                <div style={{ fontWeight: 500 }}>{selectedSale.customerName || 'Cliente Balcão'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Vendedor</div>
                                <div style={{ fontWeight: 500 }}>{selectedSale.createdBy || 'Sistema'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Tipo</div>
                                <div style={{ fontWeight: 500 }}>{getSaleTypeLabel(selectedSale)}</div>
                            </div>
                        </div>

                        {/* Items List */}
                        <div>
                            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>Itens</h3>
                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: 'var(--color-bg-secondary)' }}>
                                        <tr>
                                            <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>Produto</th>
                                            <th style={{ padding: 'var(--spacing-sm)', textAlign: 'right', fontSize: 'var(--font-size-sm)' }}>Qtd</th>
                                            <th style={{ padding: 'var(--spacing-sm)', textAlign: 'right', fontSize: 'var(--font-size-sm)' }}>Unit.</th>
                                            <th style={{ padding: 'var(--spacing-sm)', textAlign: 'right', fontSize: 'var(--font-size-sm)' }}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedSale.items.map((item, index) => (
                                            <tr key={index} style={{ borderTop: '1px solid var(--color-border)' }}>
                                                <td style={{ padding: 'var(--spacing-sm)' }}>{item.productName}</td>
                                                <td style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>{item.quantity}</td>
                                                <td style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                                                <td style={{ padding: 'var(--spacing-sm)', textAlign: 'right', fontWeight: 500 }}>
                                                    {formatCurrency(item.total)}
                                                    {editing && (
                                                        <button
                                                            onClick={() => handleRemoveItem(index)}
                                                            style={{ marginLeft: 'var(--spacing-md)', color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                                                        >
                                                            <XCircle size={16} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {editing && (
                                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', marginTop: 'var(--spacing-md)' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <Input
                                            placeholder="Código de barras ou nome do produto"
                                            value={addSearch}
                                            onChange={(e) => { setAddSearch(e.target.value); updateSuggestions(e.target.value); }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    if (highlightIndex >= 0 && suggestions[highlightIndex]) {
                                                        handleAddItemFromSuggestion(suggestions[highlightIndex]);
                                                    } else {
                                                        handleAddItem();
                                                    }
                                                } else if (e.key === 'ArrowDown') {
                                                    e.preventDefault();
                                                    setHighlightIndex(prev => Math.min(prev + 1, suggestions.length - 1));
                                                } else if (e.key === 'ArrowUp') {
                                                    e.preventDefault();
                                                    setHighlightIndex(prev => Math.max(prev - 1, 0));
                                                }
                                            }}
                                            className="no-margin"
                                        />
                                        {suggestionsOpen && suggestions.length > 0 && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginTop: '6px', maxHeight: '220px', overflowY: 'auto', zIndex: 3 }}>
                                                {suggestions.map((p, idx) => (
                                                    <div
                                                        key={p.id}
                                                        onMouseDown={(e) => { e.preventDefault(); handleAddItemFromSuggestion(p); }}
                                                        style={{ padding: '8px 12px', cursor: 'pointer', background: idx === highlightIndex ? 'var(--color-bg-hover)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                    >
                                                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{p.barcode || ''}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <Button onClick={handleAddItem} variant="primary" style={{ height: '48px' }}>Adicionar</Button>
                                </div>
                            )}
                        </div>

                        {/* Financial Summary */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ width: '100%', maxWidth: '300px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal:</span>
                                    <span>{formatCurrency(selectedSale.subtotal)}</span>
                                </div>
                                {selectedSale.discount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)', color: 'var(--color-danger)' }}>
                                        <span>Desconto:</span>
                                        <span>-{formatCurrency(selectedSale.discount)}</span>
                                    </div>
                                )}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginTop: 'var(--spacing-sm)',
                                    paddingTop: 'var(--spacing-sm)',
                                    borderTop: '1px solid var(--color-border)',
                                    fontWeight: 700,
                                    fontSize: 'var(--font-size-lg)'
                                }}>
                                    <span>Total:</span>
                                    <span>{formatCurrency(selectedSale.total)}</span>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginTop: 'var(--spacing-xs)',
                                    fontSize: 'var(--font-size-sm)',
                                    color: 'var(--color-text-secondary)'
                                }}>
                                    <span>Pagamento ({selectedSale.paymentMethod}):</span>
                                    <span>{formatCurrency(selectedSale.totalPaid || selectedSale.total)}</span>
                                </div>
                                {selectedSale.change > 0 && (
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginTop: 'var(--spacing-xs)',
                                        fontSize: 'var(--font-size-sm)',
                                        color: 'var(--color-success)'
                                    }}>
                                        <span>Troco:</span>
                                        <span>{formatCurrency(selectedSale.change)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                            {canWrite && (
                                <Button variant={editing ? 'secondary' : 'primary'} onClick={() => setEditing(!editing)}>
                                    {editing ? 'Concluir Edição' : 'Editar Itens'}
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default SalesHistoryPage;
