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

    const handlePrintDuplicate = (register) => {
        try {
            printCashRegisterReport({
                openedAt: register.openedAt,
                closedAt: register.closedAt,
                closedBy: register.closedBy || 'Admin',
                openingBalance: register.openingBalance,
                totalSales: register.totalSales || 0,
                totalSupplies: register.totalSupplies || 0,
                totalBleeds: register.totalBleeds || 0,
                totalChange: register.totalChange || 0,
                finalBalance: register.closingBalance,
                difference: register.difference,
                notes: register.notes
            }, { duplicate: true });
        } catch (error) {
            console.error('Error printing report:', error);
            showNotification('Erro ao gerar 2ª via', 'error');
        }
    };

    const handlePrintBoth = (register) => {
        try {
            handlePrintReport(register);
            handlePrintDuplicate(register);
        } catch (error) {
            console.error('Error printing reports:', error);
            showNotification('Erro ao imprimir', 'error');
        }
    };

    if (loading) return <Loading fullScreen />;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/caixa')}
                        icon={ArrowLeft}
                    >
                        Voltar
                    </Button>
                    <h1 className="text-2xl font-bold text-white">Histórico de Caixas</h1>
                </div>
            </div>

            <Card>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Data Fechamento</th>
                                <th>Operador</th>
                                <th>Saldo Inicial</th>
                                <th>Saldo Final</th>
                                <th>Diferença</th>
                                <th style={{ textAlign: 'right' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        Nenhum registro encontrado
                                    </td>
                                </tr>
                            ) : (
                                history.map((register) => (
                                    <tr key={register.id}>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <Calendar size={16} className="text-emerald-400" />
                                                {formatDateTime(register.closedAt)}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <User size={16} className="text-blue-400" />
                                                {register.closedBy || '-'}
                                            </div>
                                        </td>
                                        <td>
                                            {formatCurrency(register.openingBalance)}
                                        </td>
                                        <td className="font-medium" style={{ color: 'var(--color-success)' }}>
                                            {formatCurrency(register.closingBalance)}
                                        </td>
                                        <td className="font-medium" style={{ color: (!register.difference || register.difference === 0) ? 'var(--color-text-secondary)' : (register.difference > 0 ? 'var(--color-success)' : 'var(--color-danger)') }}>
                                            {register.difference ? formatCurrency(register.difference) : '-'}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                icon={Printer}
                                                onClick={() => handlePrintBoth(register)}
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
