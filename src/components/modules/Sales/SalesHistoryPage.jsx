import React, { useState, useEffect } from 'react';
import { Search, XCircle, Eye, Calendar, Filter, Printer } from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Loading from '../../common/Loading';
import Notification from '../../common/Notification';
import { salesService, productService, cashRegisterService, firestoreService, COLLECTIONS } from '../../../services/firestore';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { printReceipt } from '../../../utils/receiptPrinter';
import { useApp } from '../../../contexts/AppContext';
import { useCart } from '../../../contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import Modal from '../../common/Modal';

const SalesHistoryPage = () => {
    const { settings } = useApp();
    const { loadSale } = useCart();
    const navigate = useNavigate();
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [notification, setNotification] = useState(null);
    const [selectedSale, setSelectedSale] = useState(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [addSearch, setAddSearch] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);

    useEffect(() => {
        setLoading(true);
        const unsub = salesService.subscribeAll((data) => {
            setSales(data);
            setLoading(false);
        });
        return () => { try { unsub && unsub(); } catch {} };
    }, []);

    const loadSales = async () => {};

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
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
                } catch {}
                try {
                    const movements = await cashRegisterService.getMovements(sale.cashRegisterId);
                    const relatedChange = (movements || []).filter(m =>
                        m.type === 'change' &&
                        String(m.description || '').includes(`#${sale.saleNumber}`)
                    );
                    await Promise.all(
                        relatedChange.map(m => firestoreService.delete(COLLECTIONS.CASH_MOVEMENTS, m.id))
                    );
                } catch {}
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
        if (!product) return false;
        if (sale.priceType === 'cold') {
            const available = product.coldStock || 0;
            if (available < deduction) return false;
            await productService.update(product.id, { coldStock: available - deduction });
        } else {
            const available = product.stock || 0;
            if (available < deduction) return false;
            await productService.update(product.id, { stock: available - deduction });
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
            const unitPrice = selectedSale.priceType === 'wholesale'
                ? (product.wholesalePrice || product.price)
                : (selectedSale.priceType === 'cold'
                    ? (product.coldPrice || product.price)
                    : product.price);
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
            const unitPrice = selectedSale.priceType === 'wholesale'
                ? (product.wholesalePrice || product.price)
                : (selectedSale.priceType === 'cold'
                    ? (product.coldPrice || product.price)
                    : product.price);
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

    const filteredSales = (sales || [])
        .filter((sale) => {
            const textMatch =
                sale.saleNumber?.toLowerCase().includes(term.toLowerCase()) ||
                sale.customerName?.toLowerCase().includes(term.toLowerCase());
            if (textMatch || !term) return textMatch;
            const total = Number(sale.total || 0);
            if (rangeMatch) {
                const a = parseNumber(rangeMatch[1]);
                const b = parseNumber(rangeMatch[2]);
                if (a == null || b == null) return false;
                const min = Math.min(a, b), max = Math.max(a, b);
                return total >= min && total <= max;
            }
            if (opMatch) {
                const op = opMatch[1] || '=';
                const val = parseNumber(opMatch[2]);
                if (val == null) return false;
                if (op === '>') return total > val;
                if (op === '>=') return total >= val;
                if (op === '<') return total < val;
                if (op === '<=') return total <= val;
                return Math.abs(total - val) < 0.005;
            }
            const numeric = parseNumber(term);
            if (numeric != null) {
                return Math.abs(total - numeric) < 0.005;
            }
            return false;
        })
        .sort((a, b) => {
            const av = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
            const bv = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
            return bv - av;
        });

    if (loading) return <Loading fullScreen />;

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
                    gap: 'var(--spacing-md)',
                    alignItems: 'center'
                }}>
                    <div style={{ width: '100%', maxWidth: '400px' }}>
                        <Input
                            placeholder="Buscar por número, cliente ou valor (ex: 50, >=100, 50-100)"
                            icon={Search}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
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
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Sale Details Modal */}
            <Modal
                isOpen={detailsModalOpen}
                onClose={() => setDetailsModalOpen(false)}
                title={`Detalhes da Venda #${selectedSale?.saleNumber || ''}`}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <Button variant="primary" onClick={() => { loadSale(selectedSale); setDetailsModalOpen(false); navigate('/sales'); }}>
                            Editar no PDV
                        </Button>
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
                            <Button variant={editing ? 'secondary' : 'primary'} onClick={() => setEditing(!editing)}>
                                {editing ? 'Concluir Edição' : 'Editar Itens'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default SalesHistoryPage;
