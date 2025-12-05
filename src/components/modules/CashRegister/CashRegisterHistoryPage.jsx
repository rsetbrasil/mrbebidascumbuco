import React, { useState, useEffect } from 'react';
import { ArrowLeft, Printer, Calendar, User, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Loading from '../../common/Loading';
import { cashRegisterService } from '../../../services/firestore';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { printCashRegisterReport } from '../../../utils/receiptPrinter';
import { useApp } from '../../../contexts/AppContext';

const CashRegisterHistoryPage = () => {
    const navigate = useNavigate();
    const { showNotification } = useApp();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const data = await cashRegisterService.getHistory();
            setHistory(data);
        } catch (error) {
            console.error('Error loading history:', error);
            showNotification('Erro ao carregar histórico', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePrintReport = (register) => {
        try {
            printCashRegisterReport({
                openedAt: register.openedAt,
                closedAt: register.closedAt,
                closedBy: register.closedBy || 'Admin',
                openingBalance: register.openingBalance,
                totalSales: register.totalSales || 0, // Ensure these fields exist in your saved data
                totalSupplies: register.totalSupplies || 0,
                totalBleeds: register.totalBleeds || 0,
                totalChange: register.totalChange || 0,
                finalBalance: register.closingBalance, // Note: closingBalance is what's saved
                difference: register.difference,
                notes: register.notes
            });
        } catch (error) {
            console.error('Error printing report:', error);
            showNotification('Erro ao gerar relatório', 'error');
        }
    };

    if (loading) return <Loading fullScreen />;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/cash-register')}
                        icon={ArrowLeft}
                    >
                        Voltar
                    </Button>
                    <h1 className="text-2xl font-bold text-white">Histórico de Caixas</h1>
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-700 text-gray-400">
                                <th className="p-4">Data Fechamento</th>
                                <th className="p-4">Operador</th>
                                <th className="p-4">Saldo Inicial</th>
                                <th className="p-4">Saldo Final</th>
                                <th className="p-4">Diferença</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-400">
                                        Nenhum registro encontrado
                                    </td>
                                </tr>
                            ) : (
                                history.map((register) => (
                                    <tr key={register.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4 text-white">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={16} className="text-emerald-400" />
                                                {formatDateTime(register.closedAt)}
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-300">
                                            <div className="flex items-center gap-2">
                                                <User size={16} className="text-blue-400" />
                                                {register.closedBy || '-'}
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-300">
                                            {formatCurrency(register.openingBalance)}
                                        </td>
                                        <td className="p-4 font-medium text-emerald-400">
                                            {formatCurrency(register.closingBalance)}
                                        </td>
                                        <td className={`p-4 font-medium ${!register.difference || register.difference === 0
                                                ? 'text-gray-400'
                                                : register.difference > 0
                                                    ? 'text-emerald-400'
                                                    : 'text-red-400'
                                            }`}>
                                            {register.difference ? formatCurrency(register.difference) : '-'}
                                        </td>
                                        <td className="p-4 text-right">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                icon={Printer}
                                                onClick={() => handlePrintReport(register)}
                                            >
                                                Imprimir
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default CashRegisterHistoryPage;
