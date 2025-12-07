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
import MovementModal from './MovementModal';
import { useApp } from '../../../contexts/AppContext';
import { cashRegisterService, salesService } from '../../../services/firestore';
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

    const [loading, setLoading] = useState(false);
    const [movements, setMovements] = useState([]);
    const [sales, setSales] = useState([]);
    const [openingBalance, setOpeningBalance] = useState('');
    const [closingNote, setClosingNote] = useState('');
    const [modalType, setModalType] = useState(null);
    const [notification, setNotification] = useState(null);

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

        setLoading(true);
        try {
            await openCashRegister(parseFloat(openingBalance) || 0, 'Admin');
            showNotification('success', 'Caixa aberto com sucesso');
            setOpeningBalance('');
        } catch (error) {
            console.error('Error opening register:', error);
            showNotification('error', 'Erro ao abrir caixa');
        } finally {
            setLoading(false);
        }
    };

    const handleCloseRegister = async () => {
        if (!window.confirm('Tem certeza que deseja fechar o caixa?')) return;

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

            const finalBalance = currentCashRegister.openingBalance + totalSales + totalSupplies - totalBleeds;

            await closeCashRegister(finalBalance, 'Admin', closingNote);

            // Print closing report
            printCashRegisterReport({
                openedAt: currentCashRegister.openedAt,
                closedAt: new Date(),
                closedBy: 'Admin',
                openingBalance: currentCashRegister.openingBalance,
                totalSales,
                totalSupplies,
                totalBleeds,
                totalChange,
                finalBalance,
                notes: closingNote
            }, {}); // Pass settings if available

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

    const handleMovement = async (data) => {
        try {
            await addCashMovement(data.type, data.amount, data.description, 'Admin');
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
                    <p className="text-gray-400">
                        Aberto em {formatDateTime(currentCashRegister.openedAt)}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="secondary"
                        onClick={() => navigate('/historico-caixa')}
                        icon={History}
                    >
                        Histórico
                    </Button>
                    <Button
                        variant="success"
                        onClick={() => setModalType('supply')}
                        icon={ArrowUpCircle}
                    >
                        Suprimento
                    </Button>
                    <Button
                        variant="danger"
                        onClick={() => setModalType('bleed')}
                        icon={ArrowDownCircle}
                    >
                        Sangria
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-blue-500">
                    <div className="p-4">
                        <p className="text-gray-400 text-sm mb-1">Saldo Inicial</p>
                        <h3 className="text-2xl font-bold text-white">
                            {formatCurrency(currentCashRegister.openingBalance)}
                        </h3>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-green-500">
                    <div className="p-4">
                        <p className="text-gray-400 text-sm mb-1">Vendas</p>
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
                        <p className="text-gray-400 text-sm mb-1">Saldo Atual</p>
                        <h3 className="text-2xl font-bold text-primary-400">
                            {formatCurrency(currentBalance)}
                        </h3>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card title="Histórico de Movimentações" icon={History}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-700/50 text-gray-400 text-sm">
                                        <th className="p-4 font-medium">Hora</th>
                                        <th className="p-4 font-medium">Tipo</th>
                                        <th className="p-4 font-medium">Descrição</th>
                                        <th className="p-4 font-medium text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-slate-700/50">
                                    {movements.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="p-8 text-center text-gray-500">
                                                Nenhuma movimentação registrada
                                            </td>
                                        </tr>
                                    ) : (
                                        movements.map((mov) => (
                                            <tr key={mov.id} className="hover:bg-slate-700/30">
                                                <td className="p-4 text-gray-300">
                                                    {formatDateTime(mov.createdAt).split(' ')[1]}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${mov.type === 'supply'
                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                        : 'bg-red-500/10 text-red-400'
                                                        }`}>
                                                        {mov.type === 'supply' ? 'Suprimento' : 'Sangria'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-gray-300">{mov.description}</td>
                                                <td className={`p-4 text-right font-medium ${mov.type === 'supply' ? 'text-emerald-400' : 'text-red-400'
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
        </div>
    );
};

export default CashRegisterPage;
