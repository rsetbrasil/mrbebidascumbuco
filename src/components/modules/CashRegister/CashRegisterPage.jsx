import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Wallet,
    ArrowUpCircle,
    ArrowDownCircle,
    Lock,
    Unlock,
    History,
    DollarSign,
    AlertCircle,
    Printer,
    Eye,
    RotateCcw,
    Trash2,
    TrendingUp,
    TrendingDown,
    Plus,
    Minus,
    Clock,
    RefreshCw
} from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import CurrencyInput from '../../common/CurrencyInput';
import Loading from '../../common/Loading';
import Notification from '../../common/Notification';
import Modal from '../../common/Modal';
import MovementModal from './MovementModal';
import { useApp } from '../../../contexts/AppContext';
import { cashRegisterService, salesService, userService, firestoreService, COLLECTIONS, productService, presalesService } from '../../../services/firestore';
import { useAuth } from '../../../contexts/AuthContext';
import { formatCurrency, formatDateTime, parseCurrency } from '../../../utils/formatters';
import { printCashRegisterReport } from '../../../utils/receiptPrinter';

const CashRegisterPage = () => {
    const navigate = useNavigate();
    const {
        currentCashRegister,
        openCashRegister,
        closeCashRegister,
        addCashMovement,
        loading: contextLoading,
        settings
    } = useApp();
    const { user, isManager, isCashier, canWrite } = useAuth();

    const [loading, setLoading] = useState(false);
    const [movements, setMovements] = useState([]);
    const [sales, setSales] = useState([]);
    const [openingBalance, setOpeningBalance] = useState('');
    const [closingNote, setClosingNote] = useState('');
    const [modalType, setModalType] = useState(null);
    const [notification, setNotification] = useState(null);
    const [managerModalOpen, setManagerModalOpen] = useState(false);
    const [managerUsername, setManagerUsername] = useState('');
    const [managerPassword, setManagerPassword] = useState('');
    const [managerError, setManagerError] = useState('');
    const [viewOpen, setViewOpen] = useState(false);
    const [viewPaymentSummary, setViewPaymentSummary] = useState([]);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyItems, setHistoryItems] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyViewOpen, setHistoryViewOpen] = useState(false);
    const [historyViewLoading, setHistoryViewLoading] = useState(false);
    const [historyViewData, setHistoryViewData] = useState(null);
    const [historyViewPaymentSummary, setHistoryViewPaymentSummary] = useState([]);
    const [detailedReportOpen, setDetailedReportOpen] = useState(false);
    const [detailedReportLoading, setDetailedReportLoading] = useState(false);
    const [detailedItems, setDetailedItems] = useState([]);
    const [salesFilter, setSalesFilter] = useState('today'); // 'all' | 'today'
    const [closeRegisterModalOpen, setCloseRegisterModalOpen] = useState(false);
    const [isClosingMode, setIsClosingMode] = useState(false);
    const [closingBalances, setClosingBalances] = useState({});
    const [movementDescription, setMovementDescription] = useState('');
    const [movementAmount, setMovementAmount] = useState('');
    const [movementType, setMovementType] = useState('supply');

    const calculateDetailedItems = (salesList) => {
        const itemsBreakdown = [];
        for (const sale of salesList) {
            const items = Array.isArray(sale.items) ? sale.items : [];
            for (const item of items) {
                const unitPrice = Number(item.unitPrice || 0);
                const unitCost = Number(item.unitCost || 0);
                const qty = Number(item.quantity || 1);
                const profitItem = (unitPrice - unitCost) * qty;

                itemsBreakdown.push({
                    saleId: sale.id,
                    saleNumber: sale.saleNumber,
                    createdAt: sale.createdAt,
                    productName: item.productName || item.name || 'Produto sem nome',
                    quantity: qty,
                    unitPrice: unitPrice,
                    unitCost: unitCost,
                    totalPrice: unitPrice * qty,
                    totalCost: unitCost * qty,
                    profit: profitItem,
                    isWholesale: !!item.isWholesale,
                    categoryName: item.isWholesale ? 'Atacado' : 'Mercearia'
                });
            }
        }
        return itemsBreakdown;
    };

    const isRegisterOpen = !!currentCashRegister;

    useEffect(() => {
        if (isRegisterOpen && currentCashRegister) {
            loadMovements();
            loadSales();
        } else {
            loadRecentHistory();
        }
    }, [isRegisterOpen, currentCashRegister]);

    const loadRecentHistory = async () => {
        try {
            const list = await cashRegisterService.getHistory();
            setHistoryItems(list?.slice(0, 5) || []);
        } catch (e) {
            console.error('Error loading recent history:', e);
        }
    };

    const normalizePayments = (sale) => {
        if (Array.isArray(sale.payments) && sale.payments.length > 0) {
            return sale.payments.map(p => ({
                method: p.method,
                amount: Number(p.amount || 0)
            }));
        }
        return [{
            method: sale.paymentMethod || 'Dinheiro',
            amount: Number(sale.total || 0)
        }];
    };

    const enrichSalesCosts = async (salesList) => {
        const productCache = new Map();
        const unitCostByKey = new Map();

        const getProduct = async (productId) => {
            const key = String(productId || '');
            if (!key) return null;
            if (productCache.has(key)) return productCache.get(key);
            try {
                const product = await productService.getById(key);
                productCache.set(key, product || null);
                return product || null;
            } catch {
                productCache.set(key, null);
                return null;
            }
        };

        const computeUnitCost = async (sale, item) => {
            const productId = String(item?.productId || '');
            if (!productId) return Number(item?.unitCost || 0);
            const unitMultiplier = item?.unit && item.unit.multiplier ? Number(item.unit.multiplier) : 1;
            const isCold = item?.isCold === true || (sale?.priceType === 'cold' && item?.isCold !== false);
            const cacheKey = `${productId}|${isCold ? 'cold' : 'wholesale'}|${unitMultiplier}`;
            if (unitCostByKey.has(cacheKey)) return unitCostByKey.get(cacheKey);

            const product = await getProduct(productId);
            if (!product) {
                const fallback = Number(item?.unitCost || 0);
                unitCostByKey.set(cacheKey, fallback);
                return fallback;
            }

            const rawCost = Number(isCold ? (product?.coldCost || product?.cost || 0) : (product?.cost || 0));
            const costUnitMultiplier = Number(isCold ? (product?.coldUnitMultiplier || 1) : (product?.wholesaleUnitMultiplier || 1));
            const baseCost = costUnitMultiplier > 0 ? (rawCost / costUnitMultiplier) : rawCost;
            const computed = baseCost * (Number.isFinite(unitMultiplier) && unitMultiplier > 0 ? unitMultiplier : 1);
            unitCostByKey.set(cacheKey, computed);
            return computed;
        };

        const list = Array.isArray(salesList) ? salesList : [];
        return Promise.all(list.map(async (sale) => {
            const items = Array.isArray(sale?.items) ? sale.items : [];
            if (items.length === 0) return sale;
            const enrichedItems = await Promise.all(items.map(async (item) => {
                const unitCost = await computeUnitCost(sale, item);
                return { ...item, unitCost };
            }));
            const cmvTotal = enrichedItems.reduce((acc, it) => {
                const qty = Number(it?.quantity || 0);
                const unitCost = Number(it?.unitCost || 0);
                return acc + (unitCost * qty);
            }, 0);
            return { ...sale, items: enrichedItems, cmvTotal };
        }));
    };

    const loadMovements = async () => {
        try {
            const data = await cashRegisterService.getMovements(currentCashRegister.id);
            setMovements(data);
        } catch (error) {
            console.error('Error loading movements:', error);
            showNotification('error', 'Erro ao carregar movimentações');
        }
    };

    const openHistoryModal = async () => {
        try {
            setHistoryLoading(true);
            const list = await cashRegisterService.getHistory();
            setHistoryItems(list || []);
            setHistoryOpen(true);
        } catch (e) {
            showNotification('error', 'Erro ao carregar histórico');
        } finally {
            setHistoryLoading(false);
        }
    };

    const handlePrintHistory = async (register) => {
        try {
            const sales = await salesService.getByCashRegister(register.id);
            const validSales = await enrichSalesCosts((sales || []).filter(s => s && s.status !== 'cancelled'));
            const totalSales = validSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
            const totalDeliveryFees = validSales.reduce((sum, s) => sum + Number(s.deliveryFeeValue || 0), 0);
            const totalSalesProducts = validSales.reduce((sum, s) => {
                const fee = Number(s.deliveryFeeValue || 0);
                const products = s.productsTotal !== undefined ? Number(s.productsTotal || 0) : (Number(s.total || 0) - fee);
                return sum + Math.max(0, products);
            }, 0);
            const profitCalc = (() => {
                let atacado = 0;
                let mercearia = 0;
                for (const sale of validSales) {
                    const items = Array.isArray(sale.items) ? sale.items : [];
                    for (const item of items) {
                        const unitPrice = Number(item.unitPrice || 0);
                        const unitCost = Number(item.unitCost || 0);
                        const qty = Number(item.quantity || 1);
                        const lucroItem = (unitPrice - unitCost) * qty;
                        if (item.isWholesale === true) {
                            atacado += lucroItem;
                        } else {
                            mercearia += lucroItem;
                        }
                    }
                }
                return { atacado, mercearia, total: atacado + mercearia };
            })();
            const movements = await cashRegisterService.getMovements(register.id);
            const totalSupplies = (movements || [])
                .filter(m => m.type === 'supply')
                .reduce((acc, m) => acc + Number(m.amount || 0), 0);
            const totalBleeds = (movements || [])
                .filter(m => m.type === 'bleed')
                .reduce((acc, m) => acc + Number(m.amount || 0), 0);
            const totalChange = (movements || [])
                .filter(m => m.type === 'change')
                .reduce((acc, m) => acc + Number(m.amount || 0), 0);
            const finalBalance = Number(register.openingBalance || 0) + totalSalesProducts + totalSupplies - totalBleeds;

            printCashRegisterReport({
                openedAt: register.openedAt,
                closedAt: register.closedAt,
                closedBy: register.closedBy || 'Admin',
                openingBalance: register.openingBalance,
                totalSales: totalSalesProducts,
                totalDeliveryFees,
                totalSupplies,
                totalBleeds,
                totalChange,
                finalBalance,
                difference: register.difference,
                notes: register.notes,
                profitAtacado: profitCalc.atacado,
                profitMercearia: profitCalc.mercearia,
                profitTotal: profitCalc.total
            }, settings || {});
        } catch (error) {
            showNotification('error', 'Erro ao gerar relatório');
        }
    };

    const handleViewHistory = async (register) => {
        setHistoryViewOpen(true);
        setHistoryViewLoading(true);
        setHistoryViewData(null);
        setHistoryViewPaymentSummary([]);
        try {
            const sales = await salesService.getByCashRegister(register.id);
            const validSales = await enrichSalesCosts((sales || []).filter(s => s && s.status !== 'cancelled'));
            const movements = await cashRegisterService.getMovements(register.id);

            const totalSales = validSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
            const totalDeliveryFees = validSales.reduce((sum, s) => sum + Number(s.deliveryFeeValue || 0), 0);
            const totalSalesProducts = validSales.reduce((sum, s) => {
                const fee = Number(s.deliveryFeeValue || 0);
                const products = s.productsTotal !== undefined ? Number(s.productsTotal || 0) : (Number(s.total || 0) - fee);
                return sum + Math.max(0, products);
            }, 0);
            const totalSupplies = (movements || []).filter(m => m.type === 'supply').reduce((acc, m) => acc + Number(m.amount || 0), 0);
            const totalBleeds = (movements || []).filter(m => m.type === 'bleed').reduce((acc, m) => acc + Number(m.amount || 0), 0);
            const totalChange = (movements || []).filter(m => m.type === 'change').reduce((acc, m) => acc + Number(m.amount || 0), 0);
            const finalBalance = Number(register.openingBalance || 0) + totalSalesProducts + totalSupplies - totalBleeds;

            const totalCMV = validSales.reduce((sum, s) => {
                const items = Array.isArray(s.items) ? s.items : [];
                return sum + items.reduce((acc, it) => acc + (Number(it.unitCost || 0) * Number(it.quantity || 0)), 0);
            }, 0);
            const profitTotal = totalSalesProducts - totalCMV;
            const margin = totalSalesProducts > 0 ? (profitTotal / totalSalesProducts) : 0;

            const profitByType = (() => {
                let atacado = 0;
                let mercearia = 0;

                for (const sale of validSales) {
                    const items = Array.isArray(sale.items) ? sale.items : [];
                    for (const item of items) {
                        const unitPrice = Number(item.unitPrice || 0);
                        const unitCost = Number(item.unitCost || 0);
                        const qty = Number(item.quantity || 1);
                        const profitItem = (unitPrice - unitCost) * qty;

                        if (item.isWholesale === true) {
                            atacado += profitItem;
                        } else {
                            mercearia += profitItem;
                        }
                    }
                }
                return { atacado, mercearia, total: atacado + mercearia };
            })();

            const paymentsMap = new Map();
            for (const sale of validSales) {
                const gross = Number(sale.total || 0);
                const fee = Number(sale.deliveryFeeValue || 0);
                const net = sale.productsTotal !== undefined ? Number(sale.productsTotal || 0) : (gross - fee);
                const factor = gross > 0 ? (net / gross) : 1;
                const list = Array.isArray(sale.payments) && sale.payments.length > 0
                    ? sale.payments.map(p => ({ method: p.method, amount: Number(p.amount || 0) * factor }))
                    : [{ method: sale.paymentMethod || 'Dinheiro', amount: net }];
                for (const p of list) {
                    const key = String(p.method || 'Dinheiro');
                    const prev = paymentsMap.get(key) || { amount: 0, count: 0 };
                    paymentsMap.set(key, { amount: prev.amount + Number(p.amount || 0), count: prev.count + 1 });
                }
            }
            setHistoryViewPaymentSummary(Array.from(paymentsMap.entries()).map(([method, v]) => ({ method, amount: v.amount, count: v.count })));

            setHistoryViewData({
                register,
                totals: {
                    totalSales: totalSalesProducts,
                    totalDeliveryFees,
                    totalSupplies,
                    totalBleeds,
                    totalChange,
                    finalBalance
                },
                metrics: {
                    totalCMV,
                    profitTotal,
                    margin,
                    profitByType
                }
            });
            setDetailedItems(calculateDetailedItems(validSales));
        } catch (e) {
            setHistoryViewData({ register, totals: null, metrics: null });
        } finally {
            setHistoryViewLoading(false);
        }
    };

    const loadSales = async () => {
        try {
            const data = await salesService.getByCashRegister(currentCashRegister.id);
            const enriched = await enrichSalesCosts(data);
            setSales(enriched);
        } catch (error) {
            console.error('Error loading sales:', error);
            showNotification('error', 'Erro ao carregar vendas');
        }
    };

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleOpenRegister = async (e) => {
        e.preventDefault();
        if (!openingBalance) {
            showNotification('error', 'Informe o valor inicial');
            return;
        }

        if (!isManager && !isCashier) {
            showNotification('error', 'Apenas gerente ou caixa podem abrir o caixa');
            return;
        }

        setLoading(true);
        try {
            await openCashRegister(parseFloat(openingBalance) || 0, user?.name || 'Operador');
            showNotification('success', 'Caixa aberto com sucesso');
            setOpeningBalance('');
        } catch (error) {
            console.error('Error opening register:', error);
            showNotification('error', 'Erro ao abrir caixa');
        } finally {
            setLoading(false);
        }
    };

    const proceedClose = async (approvedByManagerName = null) => {
        setLoading(true);
        try {
            const start = new Date(); start.setHours(0, 0, 0, 0);
            const end = new Date(); end.setHours(23, 59, 59, 999);
            const activeSales = sales
                .filter(s => s.status !== 'cancelled')
                .filter(s => {
                    const d = (s.createdAt && typeof s.createdAt.toDate === 'function')
                        ? s.createdAt.toDate()
                        : new Date(s.createdAt || 0);
                    return d >= start && d <= end;
                });
            const totalSalesGross = activeSales.reduce((acc, sale) => acc + Number(sale.total || 0), 0);
            const totalDeliveryFees = activeSales.reduce((acc, sale) => acc + Number(sale.deliveryFeeValue || 0), 0);
            const totalSalesNet = activeSales.reduce((acc, sale) => {
                const fee = Number(sale.deliveryFeeValue || 0);
                const products = sale.productsTotal !== undefined ? Number(sale.productsTotal || 0) : (Number(sale.total || 0) - fee);
                return acc + Math.max(0, products);
            }, 0);
            const activeMovements = movements.filter(m => {
                const d = (m.createdAt && typeof m.createdAt.toDate === 'function')
                    ? m.createdAt.toDate()
                    : new Date(m.createdAt || 0);
                return d >= start && d <= end;
            });
            const totalSupplies = activeMovements
                .filter(m => m.type === 'supply')
                .reduce((acc, m) => acc + m.amount, 0);
            const totalBleeds = activeMovements
                .filter(m => m.type === 'bleed')
                .reduce((acc, m) => acc + m.amount, 0);
            const totalChange = activeMovements
                .filter(m => m.type === 'change')
                .reduce((acc, m) => acc + m.amount, 0);

            const paymentsMap = new Map();
            for (const sale of activeSales) {
                const list = normalizePayments(sale);
                for (const p of list) {
                    const key = String(p.method || 'Dinheiro');
                    const prev = paymentsMap.get(key) || { amount: 0, count: 0 };
                    paymentsMap.set(key, { amount: prev.amount + Number(p.amount || 0), count: prev.count + 1 });
                }
            }
            const paymentSummary = Array.from(paymentsMap.entries()).map(([method, v]) => ({ method, amount: v.amount, count: v.count }));

            const finalBalance = Number(currentCashRegister.openingBalance || 0) + totalSalesNet + totalSupplies - totalBleeds;

            const cents = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100);
            if (cents(totalSalesGross) - cents(totalDeliveryFees) !== cents(totalSalesNet)) {
                showNotification('error', 'Inconsistência entre total líquido e taxas de entrega. Verifique as vendas.');
                setLoading(false);
                return;
            }

            const closedByLabel = approvedByManagerName
                ? `${user?.name || 'Operador'} (aprovado por ${approvedByManagerName})`
                : (user?.name || 'Operador');

            const presalesCancelResult = await presalesService.cancelAll();
            const cancelledPresales = Number(presalesCancelResult?.cancelled || 0);

            // Use physical balance if available (isClosingMode was active), otherwise use expected
            const closingBalanceToSave = isClosingMode ? totalReported : finalBalance;

            await closeCashRegister(closingBalanceToSave, closedByLabel, closingNote);

            // Print closing report
            const profitCalc = (() => {
                let atacado = 0;
                let mercearia = 0;
                let fardo = 0;
                for (const sale of activeSales) {
                    const items = Array.isArray(sale.items) ? sale.items : [];
                    for (const item of items) {
                        const unitPrice = Number(item.unitPrice || 0);
                        const unitCost = Number(item.unitCost || 0);
                        const qty = Number(item.quantity || 1);
                        const lucroItem = (unitPrice - unitCost) * qty;
                        if (item.isWholesale === true) {
                            atacado += lucroItem;
                        } else if (item.categoryName?.toLowerCase().includes('fardo') || item.name?.toLowerCase().includes('fardo')) {
                            fardo += lucroItem;
                        } else {
                            mercearia += lucroItem;
                        }
                    }
                }
                return { atacado, mercearia, fardo, total: atacado + mercearia + fardo };
            })();
            printCashRegisterReport({
                openedAt: currentCashRegister.openedAt,
                closedAt: new Date(),
                closedBy: closedByLabel,
                openingBalance: currentCashRegister.openingBalance,
                totalSales: totalSalesNet,
                totalDeliveryFees: totalDeliveryFees,
                totalSupplies,
                totalBleeds,
                totalChange,
                finalBalance: closingBalanceToSave,
                difference: isClosingMode ? difference : 0,
                notes: closingNote,
                paymentSummary: isClosingMode ? 
                    Object.entries(closingBalances).map(([method, val]) => ({ method, amount: parseCurrency(val) || 0 })) : 
                    paymentSummary,
                profitAtacado: profitCalc.atacado,
                profitMercearia: profitCalc.mercearia,
                profitFardo: profitCalc.fardo,
                profitTotal: profitCalc.total
            }, settings || {});
            showNotification('success', `Caixa fechado com sucesso. Pré-vendas reservadas zeradas: ${cancelledPresales}.`);
            setClosingNote('');
            setMovements([]);
            setSales([]);
            openHistoryModal();
        } catch (error) {
            console.error('Error closing register:', error);
            showNotification('error', 'Erro ao fechar caixa');
        } finally {
            setLoading(false);
        }
    };

    const handleInitCloseRegister = () => {
        setIsClosingMode(true);
        // Scroll to top to see the expansion
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmCloseRegister = async () => {
        setCloseRegisterModalOpen(false);
        setManagerUsername(isManager ? (user?.username || '') : '');
        setManagerPassword('');
        setManagerError('');
        setManagerModalOpen(true);
    };

    const handlePrintOpenRegister = () => {
        try {
            const start = new Date(); start.setHours(0, 0, 0, 0);
            const end = new Date(); end.setHours(23, 59, 59, 999);
            const activeSales = sales
                .filter(s => s.status !== 'cancelled')
                .filter(s => {
                    const d = (s.createdAt && typeof s.createdAt.toDate === 'function')
                        ? s.createdAt.toDate()
                        : new Date(s.createdAt || 0);
                    return d >= start && d <= end;
                });
            const totalSalesGross = activeSales.reduce((acc, sale) => acc + Number(sale.total || 0), 0);
            const activeMovements = movements.filter(m => {
                const d = (m.createdAt && typeof m.createdAt.toDate === 'function')
                    ? m.createdAt.toDate()
                    : new Date(m.createdAt || 0);
                return d >= start && d <= end;
            });
            const totalSupplies = activeMovements
                .filter(m => m.type === 'supply')
                .reduce((acc, m) => acc + Number(m.amount || 0), 0);
            const totalBleeds = activeMovements
                .filter(m => m.type === 'bleed')
                .reduce((acc, m) => acc + Number(m.amount || 0), 0);
            const totalChange = activeMovements
                .filter(m => m.type === 'change')
                .reduce((acc, m) => acc + Number(m.amount || 0), 0);

            const paymentsMap = new Map();
            for (const sale of activeSales) {
                const list = normalizePayments(sale);
                for (const p of list) {
                    const key = String(p.method || 'Dinheiro');
                    const prev = paymentsMap.get(key) || { amount: 0, count: 0 };
                    paymentsMap.set(key, { amount: prev.amount + Number(p.amount || 0), count: prev.count + 1 });
                }
            }
            const paymentSummary = Array.from(paymentsMap.entries()).map(([method, v]) => ({ method, amount: v.amount, count: v.count }));

            const totalDeliveryFees = activeSales.reduce((acc, sale) => acc + Number(sale.deliveryFeeValue || 0), 0);
            const totalSalesNet = activeSales.reduce((acc, sale) => {
                const fee = Number(sale.deliveryFeeValue || 0);
                const products = sale.productsTotal !== undefined ? Number(sale.productsTotal || 0) : (Number(sale.total || 0) - fee);
                return acc + Math.max(0, products);
            }, 0);
            const finalBalance = Number(currentCashRegister.openingBalance || 0) + totalSalesNet + totalSupplies - totalBleeds;

            const profitCalc = (() => {
                let atacado = 0;
                let mercearia = 0;
                let fardo = 0;
                for (const sale of activeSales) {
                    const items = Array.isArray(sale.items) ? sale.items : [];
                    for (const item of items) {
                        const unitPrice = Number(item.unitPrice || 0);
                        const unitCost = Number(item.unitCost || 0);
                        const qty = Number(item.quantity || 1);
                        const lucroItem = (unitPrice - unitCost) * qty;
                        if (item.isWholesale === true) {
                            atacado += lucroItem;
                        } else if (item.categoryName?.toLowerCase().includes('fardo') || item.name?.toLowerCase().includes('fardo')) {
                            fardo += lucroItem;
                        } else {
                            mercearia += lucroItem;
                        }
                    }
                }
                return { atacado, mercearia, fardo, total: atacado + mercearia + fardo };
            })();
            printCashRegisterReport({
                openedAt: currentCashRegister.openedAt,
                closedAt: new Date(),
                closedBy: user?.name || 'Operador',
                openingBalance: currentCashRegister.openingBalance,
                totalSales: totalSalesNet,
                totalDeliveryFees,
                totalSupplies,
                totalBleeds,
                totalChange,
                finalBalance: isClosingMode ? totalReported : currentBalance,
                difference: isClosingMode ? difference : 0,
                notes: isClosingMode ? 'Conferência de Fechamento' : 'Relatório parcial (caixa aberto)',
                paymentSummary: isClosingMode ? 
                    Object.entries(closingBalances).map(([method, val]) => ({ method, amount: parseCurrency(val) || 0 })) : 
                    paymentSummary,
                profitAtacado: profitCalc.atacado,
                profitMercearia: profitCalc.mercearia,
                profitFardo: profitCalc.fardo,
                profitTotal: profitCalc.total
            }, settings || {});
        } catch (error) {
            console.error('Error printing open register snapshot:', error);
            showNotification('error', 'Erro ao imprimir resumo do caixa');
        }
    };

    const handleQuickMovement = async (e) => {
        e.preventDefault();
        if (!movementAmount || !movementDescription) {
            showNotification('error', 'Informe a descrição e o valor');
            return;
        }
        
        setLoading(true);
        try {
            const amount = parseCurrency(movementAmount);
            await addCashMovement(movementType, amount, movementDescription, user?.name || 'Operador');
            showNotification('success', 'Movimentação registrada');
            setMovementAmount('');
            setMovementDescription('');
            loadMovements();
        } catch (error) {
            console.error('Error in quick movement:', error);
            showNotification('error', 'Erro ao registrar movimentação');
        } finally {
            setLoading(false);
        }
    };

    const handleMovement = async (data) => {
        try {
            await addCashMovement(data.type, data.amount, data.description, user?.name || 'Operador');
            showNotification('success', 'Movimentação registrada');
            loadMovements();
        } catch (error) {
            throw error;
        }
    };

    const handleRevertMovement = async (mov) => {
        try {
            if (!(mov && (mov.type === 'supply' || mov.type === 'bleed'))) return;
            const opposite = mov.type === 'supply' ? 'bleed' : 'supply';
            const ok = window.confirm(`Confirmar estorno de ${mov.type === 'supply' ? 'suprimento' : 'sangria'} no valor de ${formatCurrency(mov.amount)}?`);
            if (!ok) return;
            await addCashMovement(opposite, Number(mov.amount || 0), `Estorno de ${mov.type === 'supply' ? 'suprimento' : 'sangria'}: ${mov.description || ''}`, user?.name || 'Operador');
            showNotification('success', 'Estorno registrado');
            loadMovements();
        } catch (error) {
            console.error('Error reverting movement:', error);
            showNotification('error', 'Erro ao estornar movimentação');
        }
    };

    const handleDeleteMovement = async (mov) => {
        try {
            if (!mov?.id) return;
            const ok = window.confirm('Excluir esta movimentação? Esta ação não pode ser desfeita.');
            if (!ok) return;
            await firestoreService.delete(COLLECTIONS.CASH_MOVEMENTS, mov.id);
            showNotification('success', 'Movimentação excluída');
            loadMovements();
        } catch (error) {
            console.error('Error deleting movement:', error);
            showNotification('error', 'Erro ao excluir movimentação');
        }
    };

    const handleDeleteRegister = async (registerId) => {
        if (!window.confirm('Certeza que deseja apagar este caixa? Essa ação não pode ser desfeita.')) return;
        setLoading(true);
        try {
            await cashRegisterService.delete(registerId);
            showNotification('success', 'Caixa apagado com sucesso');
            if (!isRegisterOpen) {
                loadRecentHistory();
            }
            if (historyOpen) {
                const list = await cashRegisterService.getHistory();
                setHistoryItems(list || []);
            }
        } catch (error) {
            console.error('Error deleting register:', error);
            showNotification('error', 'Erro ao apagar caixa');
        } finally {
            setLoading(false);
        }
    };

    const handleViewOpen = () => {
        try {
            const start = new Date(); start.setHours(0, 0, 0, 0);
            const end = new Date(); end.setHours(23, 59, 59, 999);
            const activeSales = sales
                .filter(s => s.status !== 'cancelled')
                .filter(s => {
                    const d = (s.createdAt && typeof s.createdAt.toDate === 'function')
                        ? s.createdAt.toDate()
                        : new Date(s.createdAt || 0);
                    return d >= start && d <= end;
                });
            const paymentsMap = new Map();
            for (const sale of activeSales) {
                const gross = Number(sale.total || 0);
                const fee = Number(sale.deliveryFeeValue || 0);
                const net = sale.productsTotal !== undefined ? Number(sale.productsTotal || 0) : (gross - fee);
                const factor = gross > 0 ? (net / gross) : 1;
                const list = Array.isArray(sale.payments) && sale.payments.length > 0
                    ? sale.payments.map(p => ({ method: p.method, amount: Number(p.amount || 0) * factor }))
                    : [{ method: sale.paymentMethod || 'Dinheiro', amount: net }];
                for (const p of list) {
                    const key = String(p.method || 'Dinheiro');
                    const prev = paymentsMap.get(key) || { amount: 0, count: 0 };
                    paymentsMap.set(key, { amount: prev.amount + Number(p.amount || 0), count: prev.count + 1 });
                }
            }
            setViewPaymentSummary(Array.from(paymentsMap.entries()).map(([method, v]) => ({ method, amount: v.amount, count: v.count })));
            setDetailedItems(calculateDetailedItems(activeSales));
            setViewOpen(true);
        } catch (e) {
            setViewPaymentSummary([]);
            setDetailedItems([]);
            setViewOpen(true);
        }
    };

    const historyModals = (
        <div style={{ position: 'relative', zIndex: 10 }}>
            <Modal
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                title="Histórico de Caixas"
                size="xl"
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
                        <Button variant="secondary" onClick={() => setHistoryOpen(false)}>Fechar</Button>
                    </div>
                }
            >
                <div className="table-container">
                    {historyLoading ? (
                        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            Carregando...
                        </div>
                    ) : (
                        <table className="table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                            <thead>
                                <tr style={{ position: 'sticky', top: 0, background: 'var(--color-bg-secondary)', zIndex: 1 }}>
                                    <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-text-muted)' }}>FECHAMENTO</th>
                                    <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-text-muted)' }}>OPERADOR</th>
                                    <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-text-muted)' }}>SALDO INICIAL</th>
                                    <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-text-muted)' }}>SALDO FINAL</th>
                                    <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-text-muted)' }}>DIFERENÇA</th>
                                    <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right', minWidth: 220, whiteSpace: 'nowrap' }}>AÇÃO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyItems.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                            Nenhum registro encontrado
                                        </td>
                                    </tr>
                                ) : (
                                    historyItems.map((register, idx) => (
                                        <tr key={register.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(148,163,184,0.06)' }}>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{formatDateTime(register.closedAt)}</span>
                                                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                                                        Abertura: {formatDateTime(register.openedAt)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>
                                                {register.closedBy || '-'}
                                            </td>
                                            <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>
                                                {formatCurrency(register.openingBalance)}
                                            </td>
                                            <td style={{ padding: '12px', fontWeight: 600, color: 'var(--color-success)' }}>
                                                {formatCurrency(register.closingBalance)}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {(() => {
                                                    const diff = Number(register.difference || 0);
                                                    const label = diff === 0 ? 'Sem diferença' : diff > 0 ? 'Sobra' : 'Falta';
                                                    const color = diff === 0 ? 'var(--color-text-muted)'
                                                        : diff > 0 ? 'var(--color-success)'
                                                        : 'var(--color-danger)';
                                                    return (
                                                        <span style={{
                                                            display: 'inline-block',
                                                            padding: '2px 8px',
                                                            borderRadius: '9999px',
                                                            background: 'rgba(148,163,184,0.12)',
                                                            color,
                                                            fontWeight: 600
                                                        }}>
                                                            {label}{diff !== 0 ? ` ${formatCurrency(diff)}` : ''}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'right' }}>
                                                <div style={{ display: 'inline-flex', gap: '8px' }}>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        icon={Eye}
                                                        onClick={() => handleViewHistory(register)}
                                                    >
                                                        Ver
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        icon={Printer}
                                                        onClick={() => handlePrintHistory(register)}
                                                    >
                                                        Imprimir
                                                    </Button>
                                                    {isManager && (
                                                        <Button
                                                            variant="danger"
                                                            size="sm"
                                                            icon={Trash2}
                                                            onClick={() => handleDeleteRegister(register.id)}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </Modal>

            <Modal
                isOpen={historyViewOpen}
                onClose={() => setHistoryViewOpen(false)}
                title="Detalhes do Caixa"
                size="md"
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
                        <Button
                            variant="primary"
                            icon={Eye}
                            onClick={() => setDetailedReportOpen(true)}
                        >
                            Ver Relatório Detalhado
                        </Button>
                        <Button variant="secondary" onClick={() => setHistoryViewOpen(false)}>Fechar</Button>
                    </div>
                }
            >
                {historyViewLoading || !historyViewData ? (
                    <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        Carregando...
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-sm)' }}>
                            <div>
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Aberto em</div>
                                <div style={{ fontWeight: 600 }}>{formatDateTime(historyViewData.register.openedAt)}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Fechado em</div>
                                <div style={{ fontWeight: 600 }}>{formatDateTime(historyViewData.register.closedAt)}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Operador</div>
                                <div style={{ fontWeight: 600 }}>{historyViewData.register.closedBy || '-'}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Saldo Inicial</div>
                                <div style={{ fontWeight: 700 }}>{formatCurrency(historyViewData.register.openingBalance)}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Saldo Final</div>
                                <div style={{ fontWeight: 700 }}>{formatCurrency(historyViewData.register.closingBalance)}</div>
                            </div>
                        </div>

                        {historyViewData.totals && (
                            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-sm)' }}>
                                <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>Resumo Financeiro</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-xs)' }}>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Vendas</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(historyViewData.totals.totalSales)}</span>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Suprimentos</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(historyViewData.totals.totalSupplies)}</span>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Sangrias</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(historyViewData.totals.totalBleeds)}</span>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Trocos</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(historyViewData.totals.totalChange)}</span>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Saldo Calculado</span><span style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(historyViewData.totals.finalBalance)}</span>
                                </div>
                            </div>
                        )}

                        {historyViewData.metrics && (
                            <>
                                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-sm)' }}>
                                    <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>Indicadores</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-xs)' }}>
                                        <span style={{ color: 'var(--color-text-secondary)' }}>CMV</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(historyViewData.metrics.totalCMV)}</span>
                                        <span style={{ color: 'var(--color-text-secondary)' }}>Lucro</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(historyViewData.metrics.profitTotal)}</span>
                                        <span style={{ color: 'var(--color-text-secondary)' }}>Margem</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{(historyViewData.metrics.margin * 100).toFixed(1)}%</span>
                                    </div>
                                </div>
                                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-sm)' }}>
                                    <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>Lucro por Tipo</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-xs)' }}>
                                        <span style={{ color: 'var(--color-text-secondary)' }}>Atacado</span><span style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(historyViewData.metrics.profitByType.atacado)}</span>
                                        <span style={{ color: 'var(--color-text-secondary)' }}>Mercearia</span><span style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>{formatCurrency(historyViewData.metrics.profitByType.mercearia)}</span>
                                        <span style={{ color: 'var(--color-text-secondary)' }}>Total</span><span style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(historyViewData.metrics.profitByType.total)}</span>
                                    </div>
                                </div>
                            </>
                        )}

                        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-sm)' }}>
                            <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>Resumo de Pagamentos</div>
                            {historyViewPaymentSummary.length === 0 ? (
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>-</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {historyViewPaymentSummary.map((p, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>{p.method}{p.count > 0 ? ` (${p.count})` : ''}</span>
                                            <span style={{ fontWeight: 600 }}>{formatCurrency(p.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {detailedReportOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--spacing-md)', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
                    <Modal
                        isOpen={true}
                        onClose={() => setDetailedReportOpen(false)}
                        title="Relatório Detalhado de Vendas (Prejuízos)"
                        size="xl"
                        footer={
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
                                <Button variant="secondary" onClick={() => setDetailedReportOpen(false)}>Fechar</Button>
                            </div>
                        }
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <div style={{ padding: 'var(--spacing-sm)', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--color-danger)', borderRadius: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)', fontWeight: 600 }}>
                                    <AlertCircle size={18} />
                                    Atenção aos itens com lucro negativo
                                </div>
                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                                    Estes produtos estão com custo unitário maior que o preço de venda, gerando prejuízo direto.
                                </p>
                            </div>

                            <div className="table-container">
                                <table className="table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                                    <thead>
                                        <tr style={{ position: 'sticky', top: 0, background: 'var(--color-bg-secondary)', zIndex: 1 }}>
                                            <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, textAlign: 'left' }}>PRODUTO</th>
                                            <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, textAlign: 'center' }}>QTD</th>
                                            <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, textAlign: 'right' }}>PREÇO UN.</th>
                                            <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, textAlign: 'right' }}>CUSTO UN.</th>
                                            <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, textAlign: 'right' }}>LUCRO TOT.</th>
                                            <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, textAlign: 'center' }}>TIPO</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detailedItems.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                                    Nenhum item encontrado
                                                </td>
                                            </tr>
                                        ) : (
                                            [...detailedItems]
                                                .sort((a, b) => a.profit - b.profit) // Show biggest losses first
                                                .map((item, idx) => (
                                                    <tr key={idx} style={{ background: item.profit < 0 ? 'rgba(239, 68, 68, 0.05)' : (idx % 2 === 0 ? 'transparent' : 'rgba(148,163,184,0.06)') }}>
                                                        <td style={{ padding: '12px' }}>
                                                            <div style={{ fontWeight: 600, color: item.profit < 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                                                                {item.productName}
                                                            </div>
                                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                                Venda #{item.saleNumber} - {formatDateTime(item.createdAt)}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>{item.quantity}</td>
                                                        <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                                                        <td style={{ padding: '12px', textAlign: 'right', color: item.unitCost > item.unitPrice ? 'var(--color-danger)' : 'inherit' }}>
                                                            {formatCurrency(item.unitCost)}
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: item.profit < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                                            {formatCurrency(item.profit)}
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                            <span style={{
                                                                fontSize: 'var(--font-size-xs)',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                background: item.isWholesale ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                                                color: item.isWholesale ? 'var(--color-success)' : 'var(--color-primary)'
                                                            }}>
                                                                {item.categoryName}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Modal>
                </div>
            )}
        </div>
    );

    if (contextLoading) return <Loading fullScreen />;

    if (!isRegisterOpen) {
        return (
            <div className="max-w-4xl mx-auto mt-10 space-y-8 animate-fade-in">
                {notification && (
                    <Notification
                        type={notification.type}
                        message={notification.message}
                        onClose={() => setNotification(null)}
                    />
                )}

                <div className="max-w-md mx-auto">
                    <Card>
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Lock size={40} className="text-gray-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Caixa Fechado</h2>
                            <p className="text-gray-400 mb-8">
                                O caixa está fechado. Informe o valor inicial para iniciar as operações.
                            </p>

                            <form onSubmit={handleOpenRegister} className="space-y-6">
                                {canWrite && (
                                    <CurrencyInput
                                        label="Valor Inicial (R$)"
                                        value={openingBalance}
                                        onChange={(e) => setOpeningBalance(e.target.value)}
                                        placeholder="0,00"
                                        className="text-center text-lg"
                                        autoFocus
                                    />
                                )}

                                <div className="grid grid-cols-1 gap-3">
                                    {canWrite && (
                                        <Button
                                            type="submit"
                                            variant="success"
                                            size="lg"
                                            loading={loading}
                                            icon={Unlock}
                                            fullWidth
                                        >
                                            Abrir Caixa
                                        </Button>
                                    )}
                                    <Button 
                                        type="button"
                                        variant="secondary" 
                                        size="lg"
                                        onClick={openHistoryModal}
                                        icon={History}
                                        fullWidth
                                    >
                                        Ver Histórico de Caixas
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </Card>
                </div>

                {historyModals}
            </div>
        );
    }

    const activeSalesView = sales
        .filter(s => s.status !== 'cancelled')
        .filter(s => {
            if (salesFilter !== 'today') return true;
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            const d = (s.createdAt && typeof s.createdAt.toDate === 'function')
                ? s.createdAt.toDate()
                : new Date(s.createdAt || 0);
            return d >= start && d <= end;
        });
    const totalSales = activeSalesView.reduce((acc, sale) => acc + sale.total, 0);
    const activeMovementsView = movements
        .filter(m => {
            const start = new Date(); start.setHours(0, 0, 0, 0);
            const end = new Date(); end.setHours(23, 59, 59, 999);
            const d = (m.createdAt && typeof m.createdAt.toDate === 'function')
                ? m.createdAt.toDate()
                : new Date(m.createdAt || 0);
            return d >= start && d <= end;
        });
    const totalSupplies = activeMovementsView
        .filter(m => m.type === 'supply')
        .reduce((acc, m) => acc + m.amount, 0);

    const totalBleeds = activeMovementsView
        .filter(m => m.type === 'bleed')
        .reduce((acc, m) => acc + m.amount, 0);

    const totalChange = activeMovementsView
        .filter(m => m.type === 'change')
        .reduce((acc, m) => acc + m.amount, 0);

    const totalFeesDay = activeSalesView.reduce((acc, sale) => acc + Number(sale.deliveryFeeValue || 0), 0);
    const totalSalesProductsDay = activeSalesView.reduce((acc, sale) => {
        const fee = Number(sale.deliveryFeeValue || 0);
        const products = sale.productsTotal !== undefined ? Number(sale.productsTotal || 0) : (Number(sale.total || 0) - fee);
        return acc + Math.max(0, products);
    }, 0);
    const totalCMVDay = activeSalesView.reduce((acc, sale) => acc + Number(sale.cmvTotal || 0), 0);
    const currentBalance = Number(currentCashRegister.openingBalance || 0) + totalSalesProductsDay + totalSupplies - totalBleeds;
    const profitDay = totalSalesProductsDay - totalCMVDay;
    const marginDay = totalSalesProductsDay > 0 ? (profitDay / totalSalesProductsDay) : 0;

    const handleClosingBalanceChange = (method, value) => {
        setClosingBalances(prev => ({
            ...prev,
            [method]: value
        }));
    };

    const totalReported = Object.values(closingBalances).reduce((sum, val) => sum + (parseCurrency(val) || 0), 0);
    const difference = totalReported - currentBalance;

    const profitByType = (() => {
        let atacado = 0;
        let mercearia = 0;
        for (const sale of activeSalesView) {
            const items = Array.isArray(sale.items) ? sale.items : [];
            for (const item of items) {
                const unitPrice = Number(item.unitPrice || 0);
                const unitCost = Number(item.unitCost || 0);
                const qty = Number(item.quantity || 1);
                const lucroItem = (unitPrice - unitCost) * qty;
                if (item.isWholesale === true) {
                    atacado += lucroItem;
                } else {
                    mercearia += lucroItem;
                }
            }
        }
        return { atacado, mercearia, total: atacado + mercearia };
    })();

    const paymentsSummaryDay = (() => {
        const map = new Map();
        for (const sale of activeSalesView) {
            const gross = Number(sale.total || 0);
            const fee = Number(sale.deliveryFeeValue || 0);
            const net = sale.productsTotal !== undefined ? Number(sale.productsTotal || 0) : (gross - fee);
            const factor = gross > 0 ? (net / gross) : 1;
            const list = Array.isArray(sale.payments) && sale.payments.length > 0
                ? sale.payments.map(p => ({ method: p.method, amount: Number(p.amount || 0) * factor }))
                : [{ method: sale.paymentMethod || 'Dinheiro', amount: net }];
            for (const p of list) {
                const key = String(p.method || 'Dinheiro').toLowerCase();
                const prev = map.get(key) || { amount: 0, count: 0 };
                map.set(key, { amount: prev.amount + Number(p.amount || 0), count: prev.count + 1 });
            }
        }
        return Array.from(map.entries()).map(([method, v]) => ({ method, amount: v.amount, count: v.count }));
    })();

    return (
        <div className="fade-in" style={{ paddingBottom: 'var(--spacing-2xl)', maxWidth: '1200px', margin: '0 auto' }}>
            {notification && (
                <Notification
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}

            {isClosingMode && (
                <div className="card" style={{ marginBottom: 'var(--spacing-xl)', border: '2px solid var(--color-danger)', background: 'var(--color-bg-secondary)' }}>
                    <div className="card-header">
                        <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                            <Lock className="text-danger" />
                            Conferência de Fechamento
                        </h2>
                        <Button variant="ghost" onClick={() => setIsClosingMode(false)}>Cancelar</Button>
                    </div>

                    <div className="grid grid-4" style={{ marginBottom: 'var(--spacing-lg)' }}>
                        <div style={{ padding: 'var(--spacing-md)', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>TROCO INICIAL</div>
                            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{formatCurrency(currentCashRegister.openingBalance)}</div>
                        </div>
                        <div style={{ padding: 'var(--spacing-md)', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>TOTAL VENDAS</div>
                            <div className="text-success" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{formatCurrency(totalSalesProductsDay)}</div>
                        </div>
                        <div style={{ padding: 'var(--spacing-md)', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>TOTAL SAÍDAS</div>
                            <div className="text-danger" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{formatCurrency(totalBleeds)}</div>
                        </div>
                        <div style={{ padding: 'var(--spacing-md)', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>SALDO ESPERADO</div>
                            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>{formatCurrency(currentBalance)}</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--spacing-xl)' }}>
                        <div className="grid grid-3">
                            {['Dinheiro', 'Pix', 'Cartão Crédito', 'Cartão Débito', 'Outros'].map((method) => (
                                <div key={method} className="input-group">
                                    <label className="input-label" style={{ textTransform: 'uppercase', fontSize: '10px' }}>{method}</label>
                                    <CurrencyInput
                                        value={closingBalances[method] || ''}
                                        onChange={(e) => handleClosingBalanceChange(method, e.target.value)}
                                        placeholder="0,00"
                                    />
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <div className="card" style={{ 
                                textAlign: 'center', 
                                border: '2px solid ' + (Math.abs(difference) < 0.01 ? 'var(--color-success)' : 'var(--color-danger)'),
                                background: (Math.abs(difference) < 0.01 ? 'var(--color-success-light)' : 'rgba(239, 68, 68, 0.1)')
                            }}>
                                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>DIFERENÇA</div>
                                <div style={{ 
                                    fontSize: 'var(--font-size-2xl)', 
                                    fontWeight: 900, 
                                    color: (Math.abs(difference) < 0.01 ? 'var(--color-success)' : 'var(--color-danger)') 
                                }}>
                                    {formatCurrency(difference)}
                                </div>
                                <div style={{ fontSize: '10px', marginTop: 'var(--spacing-sm)', color: 'var(--color-text-muted)' }}>
                                    {difference === 0 ? 'Tudo certo!' : difference > 0 ? 'Sobra de caixa' : 'Falta de caixa'}
                                </div>
                            </div>
                            
                            <Button 
                                variant="secondary" 
                                icon={Printer} 
                                fullWidth
                                onClick={handlePrintOpenRegister}
                            >
                                Imprimir Comprovante
                            </Button>
                            <Button 
                                variant="danger" 
                                icon={Lock} 
                                fullWidth
                                onClick={handleConfirmCloseRegister}
                                loading={loading}
                            >
                                Fechar Caixa
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-xl)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 900, margin: 0, color: 'var(--color-text-primary)' }}>Caixa Aberto</h1>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                        Aberto em {formatDateTime(currentCashRegister.openedAt).replace(' ', ' às ')}
                    </p>
                </div>
                <Button
                    variant="secondary"
                    onClick={handleInitCloseRegister}
                    icon={Lock}
                    style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                >
                    Fechar Caixa
                </Button>
            </div>

            <div className="grid grid-3" style={{ marginBottom: 'var(--spacing-xl)' }}>
                {/* Entradas Card */}
                <div style={{ 
                    background: 'rgba(16, 185, 129, 0.05)', 
                    borderRadius: 'var(--radius-xl)', 
                    padding: 'var(--spacing-xl)', 
                    border: '1px solid rgba(16, 185, 129, 0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <TrendingUp size={120} style={{ position: 'absolute', right: '-10px', top: '-10px', opacity: 0.05, color: 'var(--color-success)' }} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
                            <div style={{ width: '40px', height: '40px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', color: 'var(--color-success)' }}>
                                <TrendingUp size={20} />
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-success)' }}>Entradas</span>
                        </div>
                        <h3 style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 900, margin: 0, color: 'var(--color-success)', letterSpacing: '-0.02em' }}>
                            {formatCurrency(totalSalesProductsDay + totalSupplies)}
                        </h3>
                    </div>
                </div>

                {/* Saídas Card */}
                <div style={{ 
                    background: 'rgba(239, 68, 68, 0.05)', 
                    borderRadius: 'var(--radius-xl)', 
                    padding: 'var(--spacing-xl)', 
                    border: '1px solid rgba(239, 68, 68, 0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <TrendingDown size={120} style={{ position: 'absolute', right: '-10px', top: '-10px', opacity: 0.05, color: 'var(--color-danger)' }} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
                            <div style={{ width: '40px', height: '40px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-danger)' }}>
                                <TrendingDown size={20} />
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-danger)' }}>Saídas</span>
                        </div>
                        <h3 style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 900, margin: 0, color: 'var(--color-danger)', letterSpacing: '-0.02em' }}>
                            {formatCurrency(totalBleeds)}
                        </h3>
                    </div>
                </div>

                {/* Saldo Card */}
                <div style={{ 
                    background: 'rgba(99, 102, 241, 0.05)', 
                    borderRadius: 'var(--radius-xl)', 
                    padding: 'var(--spacing-xl)', 
                    border: '1px solid rgba(99, 102, 241, 0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <DollarSign size={120} style={{ position: 'absolute', right: '-10px', top: '-10px', opacity: 0.05, color: 'var(--color-primary)' }} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
                            <div style={{ width: '40px', height: '40px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                                <DollarSign size={20} />
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-primary)' }}>Total em Caixa</span>
                        </div>
                        <h3 style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 900, margin: 0, color: 'var(--color-primary)', letterSpacing: '-0.02em' }}>
                            {formatCurrency(currentBalance)}
                        </h3>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: 0 }}>
                            Inclui {formatCurrency(currentCashRegister.openingBalance)} de troco inicial
                        </p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--spacing-xl)' }}>
                {/* Left Column: Novo Lançamento */}
                <div>
                    <Card title="Novo Lançamento" icon={RefreshCw} style={{ height: '100%' }}>
                        <form onSubmit={handleQuickMovement} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                            <div style={{ display: 'flex', background: 'var(--color-bg-tertiary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                                <button
                                    type="button"
                                    onClick={() => setMovementType('supply')}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        padding: '10px',
                                        border: 'none',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: 'var(--font-size-sm)',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        background: movementType === 'supply' ? 'var(--color-success)' : 'transparent',
                                        color: movementType === 'supply' ? 'white' : 'var(--color-text-secondary)'
                                    }}
                                >
                                    <Plus size={16} /> Entrada
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMovementType('bleed')}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        padding: '10px',
                                        border: 'none',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: 'var(--font-size-sm)',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        background: movementType === 'bleed' ? 'var(--color-danger)' : 'transparent',
                                        color: movementType === 'bleed' ? 'white' : 'var(--color-text-secondary)'
                                    }}
                                >
                                    <Minus size={16} /> Saída
                                </button>
                            </div>

                            <Input
                                label="Descrição"
                                value={movementDescription}
                                onChange={(e) => setMovementDescription(e.target.value)}
                                placeholder="Ex: Pagamento Fornecedor"
                            />

                            <CurrencyInput
                                label="Valor (R$)"
                                value={movementAmount}
                                onChange={(e) => setMovementAmount(e.target.value)}
                                placeholder="0,00"
                            />

                            <Button
                                type="submit"
                                variant="primary"
                                fullWidth
                                loading={loading}
                                style={{ background: '#1e293b', border: 'none', height: '50px', fontSize: 'var(--font-size-md)' }}
                            >
                                Registrar Lançamento
                            </Button>
                        </form>
                    </Card>
                </div>

                {/* Right Column: Movimentações do Caixa */}
                <div>
                    <Card title="Movimentações do Caixa" icon={Clock} style={{ height: '100%', minHeight: '400px' }}>
                        {activeMovementsView.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--spacing-2xl)', color: 'var(--color-text-muted)' }}>
                                <Clock size={48} style={{ opacity: 0.2, marginBottom: 'var(--spacing-md)' }} />
                                <p style={{ fontWeight: 600 }}>Nenhum movimento registrado neste caixa.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                {activeMovementsView.map((mov) => (
                                    <div key={mov.id} style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between', 
                                        padding: 'var(--spacing-md)', 
                                        background: 'var(--color-bg-secondary)', 
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-divider)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                            <div style={{ 
                                                width: '36px', 
                                                height: '36px', 
                                                borderRadius: '50%', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                background: mov.type === 'supply' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                color: mov.type === 'supply' ? 'var(--color-success)' : 'var(--color-danger)'
                                            }}>
                                                {mov.type === 'supply' ? <Plus size={18} /> : <Minus size={18} />}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{mov.description}</div>
                                                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={10} /> {formatDateTime(mov.createdAt).split(' ')[1]}
                                                    <span style={{ width: '3px', height: '3px', background: 'currentColor', borderRadius: '50%' }}></span>
                                                    {mov.type === 'supply' ? 'Entrada' : 'Saída'}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
                                            <div style={{ 
                                                fontSize: 'var(--font-size-lg)', 
                                                fontWeight: 800,
                                                color: mov.type === 'supply' ? 'var(--color-success)' : 'var(--color-danger)'
                                            }}>
                                                {mov.type === 'supply' ? '+' : '-'} {formatCurrency(mov.amount)}
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    icon={RotateCcw} 
                                                    onClick={() => handleRevertMovement(mov)}
                                                    style={{ padding: '4px' }}
                                                />
                                                {isManager && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        icon={Trash2} 
                                                        onClick={() => handleDeleteMovement(mov)}
                                                        style={{ padding: '4px' }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            <MovementModal
                isOpen={!!modalType}
                onClose={() => setModalType(null)}
                onSave={handleMovement}
                type={modalType}
            />

            <Modal
                isOpen={viewOpen}
                onClose={() => setViewOpen(false)}
                title="Caixa Atual"
                size="md"
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
                        <Button
                            variant="primary"
                            icon={Eye}
                            onClick={() => setDetailedReportOpen(true)}
                        >
                            Ver Relatório Detalhado
                        </Button>
                        <Button variant="secondary" onClick={() => setViewOpen(false)}>Fechar</Button>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-sm)' }}>
                        <div>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Aberto em</div>
                            <div style={{ fontWeight: 600 }}>{formatDateTime(currentCashRegister.openedAt)}</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Operador</div>
                            <div style={{ fontWeight: 600 }}>{user?.name || 'Operador'}</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Saldo Inicial</div>
                            <div style={{ fontWeight: 700 }}>{formatCurrency(currentCashRegister.openingBalance)}</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Saldo Atual</div>
                            <div style={{ fontWeight: 700 }}>{formatCurrency(currentBalance)}</div>
                        </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-sm)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>Resumo Financeiro</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-xs)' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Vendas (líquido)</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalSalesProductsDay)}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Taxas de entrega</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalFeesDay)}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Suprimentos</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalSupplies)}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Sangrias</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalBleeds)}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Trocos</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalChange)}</span>
                        </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-sm)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>Indicadores do Dia</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-xs)' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Receita (líquida)</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalSalesProductsDay)}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>CMV</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalCMVDay)}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Lucro</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(profitDay)}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Margem</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{(marginDay * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-sm)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>Lucro por Tipo</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-xs)' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Atacado</span><span style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(profitByType.atacado)}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Mercearia</span><span style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>{formatCurrency(profitByType.mercearia)}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Total</span><span style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(profitByType.total)}</span>
                        </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-sm)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>Resumo de Pagamentos</div>
                        {viewPaymentSummary.length === 0 ? (
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>-</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {viewPaymentSummary.map((p, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{p.method}{p.count > 0 ? ` (${p.count})` : ''}</span>
                                        <span style={{ fontWeight: 600 }}>{formatCurrency(p.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
            {historyModals}

            {/* Manager Approval Modal for Cashier Closing */}
            <Modal
                isOpen={managerModalOpen}
                onClose={() => setManagerModalOpen(false)}
                title="Aprovação do Gerente"
            >
                <div className="space-y-4">
                    <p className="text-gray-400 text-sm">Informe usuário e senha do gerente para fechar o caixa.</p>
                    <Input
                        label="Usuário do Gerente"
                        value={managerUsername}
                        onChange={(e) => setManagerUsername(e.target.value)}
                        placeholder="ex: admin"
                        autoFocus
                    />
                    <Input
                        label="Senha do Gerente"
                        type="password"
                        value={managerPassword}
                        onChange={(e) => setManagerPassword(e.target.value)}
                        placeholder="••••"
                    />
                    {managerError && (
                        <div className="text-red-400 text-sm">{managerError}</div>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setManagerModalOpen(false)}>Cancelar</Button>
                        <Button
                            variant="primary"
                            onClick={async () => {
                                setManagerError('');
                                try {
                                    const mgr = await userService.getByUsername(managerUsername);
                                    if (!mgr) {
                                        setManagerError('Gerente não encontrado');
                                        return;
                                    }
                                    if (mgr.role !== 'manager') {
                                        setManagerError('Usuário informado não é gerente');
                                        return;
                                    }
                                    if (!mgr.active) {
                                        setManagerError('Gerente inativo');
                                        return;
                                    }
                                    if (mgr.password !== managerPassword) {
                                        setManagerError('Senha incorreta');
                                        return;
                                    }
                                    setManagerModalOpen(false);
                                    await proceedClose(mgr.name || mgr.username);
                                } catch (e) {
                                    setManagerError(e.message || 'Erro ao validar gerente');
                                }
                            }}
                        >
                            Validar e Fechar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CashRegisterPage;
