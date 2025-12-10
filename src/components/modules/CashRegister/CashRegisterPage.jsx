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
    AlertCircle
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
import { cashRegisterService, salesService, userService } from '../../../services/firestore';
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
        loading: contextLoading
    } = useApp();
    const { user, isManager, isCashier } = useAuth();

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

    const isRegisterOpen = !!currentCashRegister;

    useEffect(() => {
        if (isRegisterOpen && currentCashRegister) {
            loadMovements();
            loadSales();
        }
    }, [isRegisterOpen, currentCashRegister]);

    const loadMovements = async () => {
        try {
            const data = await cashRegisterService.getMovements(currentCashRegister.id);
            setMovements(data);
        } catch (error) {
            console.error('Error loading movements:', error);
            showNotification('error', 'Erro ao carregar movimentações');
        }
    };

    const loadSales = async () => {
        try {
            const data = await salesService.getByCashRegister(currentCashRegister.id);
            setSales(data);
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
            const totalSales = sales.reduce((acc, sale) => acc + sale.total, 0);
            const totalSupplies = movements
                .filter(m => m.type === 'supply')
                .reduce((acc, m) => acc + m.amount, 0);
            const totalBleeds = movements
                .filter(m => m.type === 'bleed')
                .reduce((acc, m) => acc + m.amount, 0);
            const totalChange = movements
                .filter(m => m.type === 'change')
                .reduce((acc, m) => acc + m.amount, 0);

            // Compute profit breakdown: Atacado (wholesale) vs Mercearia (cold)
            let profitWholesale = 0;
            let profitMercearia = 0;
            for (const sale of sales) {
                const items = sale.items || [];
                let revW = 0, revM = 0, revOther = 0;
                let costW = 0, costM = 0;
                for (const item of items) {
                    const qty = Number(item.quantity || 0);
                    const revenue = (Number(item.unitPrice || 0) * qty) - Number(item.discount || 0);
                    const cost = Number(item.unitCost || 0) * qty;
                    if (item.isCold) {
                        revM += revenue; costM += cost;
                    } else if (item.isWholesale) {
                        revW += revenue; costW += cost;
                    } else {
                        revOther += revenue;
                    }
                }
                const totalRev = revW + revM + revOther;
                const saleDiscount = Number(sale.discount || 0);
                const discW = totalRev > 0 ? saleDiscount * (revW / totalRev) : 0;
                const discM = totalRev > 0 ? saleDiscount * (revM / totalRev) : 0;
                profitWholesale += (revW - discW) - costW;
                profitMercearia += (revM - discM) - costM;
            }

            const paymentsMap = new Map();
            for (const sale of sales) {
                const list = Array.isArray(sale.payments) && sale.payments.length > 0
                    ? sale.payments
                    : [{ method: sale.paymentMethod || 'Dinheiro', amount: Number(sale.total || 0) }];
                for (const p of list) {
                    const key = String(p.method || 'Dinheiro');
                    const prev = paymentsMap.get(key) || { amount: 0, count: 0 };
                    paymentsMap.set(key, { amount: prev.amount + Number(p.amount || 0), count: prev.count + 1 });
                }
            }
            const paymentSummary = Array.from(paymentsMap.entries()).map(([method, v]) => ({ method, amount: v.amount, count: v.count }));

            const finalBalance = currentCashRegister.openingBalance + totalSales + totalSupplies - totalBleeds;

            const closedByLabel = approvedByManagerName
                ? `${user?.name || 'Operador'} (aprovado por ${approvedByManagerName})`
                : (user?.name || 'Operador');

            await closeCashRegister(finalBalance, closedByLabel, closingNote, {
                totalSales,
                totalSupplies,
                totalBleeds,
                totalChange,
                profitWholesale,
                profitMercearia,
                paymentSummary
            });

            // Print closing report
            printCashRegisterReport({
                openedAt: currentCashRegister.openedAt,
                closedAt: new Date(),
                closedBy: closedByLabel,
                openingBalance: currentCashRegister.openingBalance,
                totalSales,
                totalSupplies,
                totalBleeds,
                totalChange,
                finalBalance,
                notes: closingNote,
                profitWholesale,
                profitMercearia,
                paymentSummary
            }, {}); // Pass settings if available

            printCashRegisterReport({
                openedAt: currentCashRegister.openedAt,
                closedAt: new Date(),
                closedBy: closedByLabel,
                openingBalance: currentCashRegister.openingBalance,
                totalSales,
                totalSupplies,
                totalBleeds,
                totalChange,
                finalBalance,
                notes: closingNote,
                profitWholesale,
                profitMercearia,
                paymentSummary
            }, { duplicate: true });

            showNotification('success', 'Caixa fechado com sucesso');
            setClosingNote('');
            setMovements([]);
            setSales([]);
        } catch (error) {
            console.error('Error closing register:', error);
            showNotification('error', 'Erro ao fechar caixa');
        } finally {
            setLoading(false);
        }
    };

    const handleCloseRegister = async () => {
        if (!window.confirm('Tem certeza que deseja fechar o caixa?')) return;

        if (isManager) {
            await proceedClose();
            return;
        }

        if (isCashier) {
            setManagerUsername('');
            setManagerPassword('');
            setManagerError('');
            setManagerModalOpen(true);
            return;
        }

        showNotification('error', 'Somente gerente pode fechar o caixa');
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

    if (contextLoading) return <Loading fullScreen />;

    if (!isRegisterOpen) {
        return (
            <div className="max-w-md mx-auto mt-10 animate-fade-in">
                {notification && (
                    <Notification
                        type={notification.type}
                        message={notification.message}
                        onClose={() => setNotification(null)}
                    />
                )}

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
                            <CurrencyInput
                                label="Valor Inicial (R$)"
                                value={openingBalance}
                                onChange={(e) => setOpeningBalance(e.target.value)}
                                placeholder="0,00"
                                className="text-center text-lg"
                                autoFocus
                            />

                            <Button
                                type="submit"
                                variant="primary"
                                fullWidth
                                size="lg"
                                loading={loading}
                                icon={Unlock}
                            >
                                Abrir Caixa
                            </Button>
                        </form>
                    </div>
                </Card>
            </div>
        );
    }

    const totalSales = sales.reduce((acc, sale) => acc + sale.total, 0);
    const totalSupplies = movements
        .filter(m => m.type === 'supply')
        .reduce((acc, m) => acc + m.amount, 0);

    const totalBleeds = movements
        .filter(m => m.type === 'bleed')
        .reduce((acc, m) => acc + m.amount, 0);

    const totalChange = movements
        .filter(m => m.type === 'change')
        .reduce((acc, m) => acc + m.amount, 0);

    const currentBalance = currentCashRegister.openingBalance + totalSales + totalSupplies - totalBleeds;

    return (
        <div className="space-y-6 animate-fade-in">
            {notification && (
                <Notification
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Wallet className="text-primary-500" />
                        Controle de Caixa
                    </h1>
                    <p className="text-gray-400">Aberto em {formatDateTime(currentCashRegister.openedAt)}</p>
                </div>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 'var(--spacing-sm)',
                        width: '100%',
                        maxWidth: '720px'
                    }}
                >
                    <Button
                        variant="secondary"
                        onClick={() => navigate('/historico-caixa')}
                        icon={History}
                        fullWidth
                    >
                        Histórico
                    </Button>
                    <Button
                        variant="success"
                        onClick={() => setModalType('supply')}
                        icon={ArrowUpCircle}
                        fullWidth
                    >
                        Suprimento
                    </Button>
                    <Button
                        variant="danger"
                        onClick={() => setModalType('bleed')}
                        icon={ArrowDownCircle}
                        fullWidth
                    >
                        Sangria
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleCloseRegister}
                        icon={Lock}
                        fullWidth
                    >
                        Fechar Caixa
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-blue-500">
                    <div className="p-4">
                        <p className="text-gray-400 text-sm mb-1 flex items-center gap-2"><Unlock size={16} className="text-blue-400" /> Saldo Inicial</p>
                        <h3 className="text-2xl font-bold text-white">
                            {formatCurrency(currentCashRegister.openingBalance)}
                        </h3>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-green-500">
                    <div className="p-4">
                        <p className="text-gray-400 text-sm mb-1 flex items-center gap-2"><DollarSign size={16} className="text-green-400" /> Vendas</p>
                        <h3 className="text-2xl font-bold text-green-400">
                            {formatCurrency(totalSales)}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">{sales.length} venda(s)</p>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-emerald-500">
                    <div className="p-4">
                        <p className="text-gray-400 text-sm mb-1">Suprimentos</p>
                        <h3 className="text-2xl font-bold text-emerald-400">
                            {formatCurrency(totalSupplies)}
                        </h3>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-red-500">
                    <div className="p-4">
                        <p className="text-gray-400 text-sm mb-1">Sangrias</p>
                        <h3 className="text-2xl font-bold text-red-400">
                            {formatCurrency(totalBleeds)}
                        </h3>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-orange-500">
                    <div className="p-4">
                        <p className="text-gray-400 text-sm mb-1">Trocos</p>
                        <h3 className="text-2xl font-bold text-orange-400">
                            {formatCurrency(totalChange)}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Saída de caixa</p>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-primary-500">
                    <div className="p-4">
                        <p className="text-gray-400 text-sm mb-1 flex items-center gap-2"><Wallet size={16} className="text-primary-400" /> Saldo Atual</p>
                        <h3 className="text-2xl font-bold text-primary-400">
                            {formatCurrency(currentBalance)}
                        </h3>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-emerald-500">
                    <div className="p-4">
                        <p className="text-gray-400 text-sm mb-1 flex items-center gap-2"><ArrowUpCircle size={16} className="text-emerald-400" /> Suprimentos</p>
                        <h3 className="text-2xl font-bold text-emerald-400">
                            {formatCurrency(totalSupplies)}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">{movements.filter(m => m.type === 'supply').length} lançamento(s)</p>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-red-500">
                    <div className="p-4">
                        <p className="text-gray-400 text-sm mb-1 flex items-center gap-2"><ArrowDownCircle size={16} className="text-red-400" /> Sangrias</p>
                        <h3 className="text-2xl font-bold text-red-400">
                            {formatCurrency(totalBleeds)}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">{movements.filter(m => m.type === 'bleed').length} lançamento(s)</p>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-orange-500">
                    <div className="p-4">
                        <p className="text-gray-400 text-sm mb-1 flex items-center gap-2"><DollarSign size={16} className="text-orange-400" /> Trocos</p>
                        <h3 className="text-2xl font-bold text-orange-400">
                            {formatCurrency(totalChange)}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">{movements.filter(m => m.type === 'change').length} lançamento(s)</p>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card title="Histórico de Movimentações" icon={History}>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Hora</th>
                                        <th>Tipo</th>
                                        <th>Descrição</th>
                                        <th style={{ textAlign: 'right' }}>Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                                Nenhuma movimentação registrada
                                            </td>
                                        </tr>
                                    ) : (
                                        movements.map((mov) => (
                                            <tr key={mov.id}>
                                                <td>
                                                    {formatDateTime(mov.createdAt).split(' ')[1]}
                                                </td>
                                                <td>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${mov.type === 'supply'
                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                        : 'bg-red-500/10 text-red-400'
                                                        }`}>
                                                        {mov.type === 'supply' ? 'Suprimento' : 'Sangria'}
                                                    </span>
                                                </td>
                                                <td>{mov.description}</td>
                                                <td className={`text-right font-medium ${mov.type === 'supply' ? 'text-emerald-400' : 'text-red-400'
                                                    }`}>
                                                    {mov.type === 'supply' ? '+' : '-'}{formatCurrency(mov.amount)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                <div>
                    <Card title="Fechar Caixa" className="border-red-500/20">
                        <div className="p-4 space-y-4">
                            <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
                                    <div>
                                        <h4 className="font-medium text-red-400 mb-1">Atenção</h4>
                                        <p className="text-sm text-red-300/80">
                                            Ao fechar o caixa, você não poderá mais registrar vendas ou movimentações nesta sessão.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <Input
                                label="Observações de Fechamento"
                                value={closingNote}
                                onChange={(e) => setClosingNote(e.target.value)}
                                placeholder="Ex: Diferença de R$ 2,00 no caixa..."
                                textarea
                            />

                            <Button
                                variant="danger"
                                fullWidth
                                onClick={handleCloseRegister}
                                loading={loading}
                                icon={Lock}
                            >
                                Fechar Caixa Agora
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            <MovementModal
                isOpen={!!modalType}
                onClose={() => setModalType(null)}
                onSave={handleMovement}
                type={modalType}
            />

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
