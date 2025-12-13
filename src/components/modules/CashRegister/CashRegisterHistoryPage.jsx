import React, { useState, useEffect } from 'react';
import { ArrowLeft, Printer, Calendar, User, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Loading from '../../common/Loading';
import { cashRegisterService, salesService } from '../../../services/firestore';
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

    const handlePrintReport = async (register) => {
        try {
            const sales = await salesService.getByCashRegister(register.id);
            const validSales = (sales || []).filter(s => s && s.status !== 'cancelled');
            const totalSales = validSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
            const totalCost = validSales.reduce((sum, s) => {
                const items = Array.isArray(s.items) ? s.items : [];
                const cost = items.reduce((acc, it) => acc + (Number(it.unitCost || 0) * Number(it.quantity || 0)), 0);
                return sum + cost;
            }, 0);
            const totalProfit = Math.max(0, totalSales - totalCost);

            printCashRegisterReport({
                openedAt: register.openedAt,
                closedAt: register.closedAt,
                closedBy: register.closedBy || 'Admin',
                openingBalance: register.openingBalance,
                totalSales,
                totalCost,
                totalProfit,
                totalSupplies: register.totalSupplies || 0,
                totalBleeds: register.totalBleeds || 0,
                totalChange: register.totalChange || 0,
                finalBalance: register.closingBalance, // Note: closingBalance é o que foi salvo
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
                                <th className="p-4" style={{minWidth: 180}}>Data</th>
                                <th className="p-4" style={{minWidth: 200}}>Operador</th>
                                <th className="p-4" style={{minWidth: 140}}>Saldo Inicial</th>
                                <th className="p-4" style={{minWidth: 140}}>Saldo Final</th>
                                <th className="p-4" style={{minWidth: 140}}>Diferença</th>
                                <th className="p-4 text-right" style={{minWidth: 140}}>Ações</th>
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
                                        <td className="p-4 text-white align-top">
                                            <div className="flex items-start gap-2">
                                                <Calendar size={16} className="text-emerald-400 mt-0.5" />
                                                <div>
                                                    <div className="font-medium">{formatDateTime(register.closedAt)}</div>
                                                    <div className="text-gray-400 text-sm">Abertura: {formatDateTime(register.openedAt)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-300 align-top">
                                            <div className="flex items-start gap-2">
                                                <User size={16} className="text-blue-400 mt-0.5" />
                                                <div className="break-words">{register.closedBy || '-'}</div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-300">
                                            {formatCurrency(register.openingBalance)}
                                        </td>
                                        <td className="p-4 font-medium text-emerald-400">
                                            {formatCurrency(register.closingBalance)}
                                        </td>
                                        <td className="p-4">
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
                                                        background: 'rgba(148, 163, 184, 0.15)',
                                                        color,
                                                        fontWeight: 600
                                                    }}>
                                                        {label}{diff !== 0 ? ` ${formatCurrency(diff)}` : ''}
                                                    </span>
                                                );
                                            })()}
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
