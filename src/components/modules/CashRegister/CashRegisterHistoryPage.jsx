import React, { useState, useEffect } from 'react';
import { ArrowLeft, Printer, Calendar, User, DollarSign, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Loading from '../../common/Loading';
import Modal from '../../common/Modal';
import { cashRegisterService, salesService } from '../../../services/firestore';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { printCashRegisterReport } from '../../../utils/receiptPrinter';
import { useApp } from '../../../contexts/AppContext';

const CashRegisterHistoryPage = () => {
    const navigate = useNavigate();
    const { showNotification } = useApp();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewOpen, setViewOpen] = useState(false);
    const [selectedRegister, setSelectedRegister] = useState(null);

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

    const buildPaymentSummary = async (registerId) => {
        try {
            const sales = await salesService.getByCashRegister(registerId);
            const map = new Map();
            for (const sale of sales) {
                const list = Array.isArray(sale.payments) && sale.payments.length > 0
                    ? sale.payments
                    : [{ method: sale.paymentMethod || 'Dinheiro', amount: Number(sale.total || 0) }];
                for (const p of list) {
                    const key = String(p.method || 'Dinheiro');
                    const prev = map.get(key) || { amount: 0, count: 0 };
                    map.set(key, { amount: prev.amount + Number(p.amount || 0), count: prev.count + 1 });
                }
            }
            return Array.from(map.entries()).map(([method, v]) => ({ method, amount: v.amount, count: v.count }));
        } catch {
            return [];
        }
    };

    const handlePrintReport = async (register) => {
        try {
            const paymentSummary = (Array.isArray(register.paymentSummary) && register.paymentSummary.length > 0)
                ? register.paymentSummary
                : await buildPaymentSummary(register.id);
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
                notes: register.notes,
                profitWholesale: register.profitWholesale || 0,
                profitMercearia: register.profitMercearia || 0,
                paymentSummary
            });
        } catch (error) {
            console.error('Error printing report:', error);
            showNotification('Erro ao gerar relatório', 'error');
        }
    };

    const handlePrintDuplicate = async (register) => {
        try {
            const paymentSummary = (Array.isArray(register.paymentSummary) && register.paymentSummary.length > 0)
                ? register.paymentSummary
                : await buildPaymentSummary(register.id);
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
                notes: register.notes,
                profitWholesale: register.profitWholesale || 0,
                profitMercearia: register.profitMercearia || 0,
                paymentSummary
            }, { duplicate: true });
        } catch (error) {
            console.error('Error printing report:', error);
            showNotification('Erro ao gerar 2ª via', 'error');
        }
    };

    const handlePrintBoth = async (register) => {
        try {
            await handlePrintReport(register);
            await handlePrintDuplicate(register);
        } catch (error) {
            console.error('Error printing reports:', error);
            showNotification('Erro ao imprimir', 'error');
        }
    };

    const handleView = async (register) => {
        try {
            let paymentSummary = Array.isArray(register.paymentSummary) ? register.paymentSummary : [];
            if (!paymentSummary || paymentSummary.length === 0) {
                paymentSummary = await buildPaymentSummary(register.id);
            }
            setSelectedRegister({ ...register, paymentSummary });
            setViewOpen(true);
        } catch (e) {
            setSelectedRegister(register);
            setViewOpen(true);
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
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    icon={Eye}
                                                    onClick={() => handleView(register)}
                                                >
                                                    Ver
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    icon={Printer}
                                                    onClick={() => handlePrintBoth(register)}
                                                >
                                                    Imprimir
                                                </Button>
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
                isOpen={viewOpen}
                onClose={() => { setViewOpen(false); setSelectedRegister(null); }}
                title="Detalhes do Fechamento"
                size="md"
            >
                {selectedRegister && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)' }}>
                            <div>
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Abertura</div>
                                <div style={{ fontWeight: 600 }}>{formatDateTime(selectedRegister.openedAt)}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Fechamento</div>
                                <div style={{ fontWeight: 600 }}>{formatDateTime(selectedRegister.closedAt)}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Operador</div>
                                <div style={{ fontWeight: 600 }}>{selectedRegister.closedBy || 'Admin'}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Saldo Inicial</div>
                                <div style={{ fontWeight: 600 }}>{formatCurrency(selectedRegister.openingBalance)}</div>
                            </div>
                        </div>

                        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)' }}>
                                <div>
                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Vendas (+)</div>
                                    <div style={{ fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(selectedRegister.totalSales || 0)}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Suprimentos (+)</div>
                                    <div style={{ fontWeight: 600, color: 'var(--color-emerald)' }}>{formatCurrency(selectedRegister.totalSupplies || 0)}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Sangrias (-)</div>
                                    <div style={{ fontWeight: 600, color: 'var(--color-danger)' }}>{formatCurrency(selectedRegister.totalBleeds || 0)}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Trocos (-)</div>
                                    <div style={{ fontWeight: 600, color: 'var(--color-warning)' }}>{formatCurrency(selectedRegister.totalChange || 0)}</div>
                                </div>
                            </div>
                            <div style={{ marginTop: 'var(--spacing-sm)', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                <span>Saldo Final</span>
                                <span>{formatCurrency(selectedRegister.closingBalance || selectedRegister.finalBalance || 0)}</span>
                            </div>
                            {(selectedRegister.difference || 0) !== 0 && (
                                <div style={{ marginTop: 'var(--spacing-xs)', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                    <span>Diferença</span>
                                    <span>{formatCurrency(selectedRegister.difference)}</span>
                                </div>
                            )}
                        </div>

                        <div>
                            <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>Formas de Pagamento</div>
                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-sm)' }}>
                                {Array.isArray(selectedRegister.paymentSummary) && selectedRegister.paymentSummary.length > 0 ? (
                                    selectedRegister.paymentSummary.map((p, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                                            <span style={{ color: 'var(--color-text-secondary)' }}>{p.method}{Number(p.count || 0) > 0 ? ` (${p.count})` : ''}</span>
                                            <span style={{ fontWeight: 600 }}>{formatCurrency(Number(p.amount || 0))}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>-</div>
                                )}
                            </div>
                        </div>

                        <div>
                            <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>Lucro</div>
                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-sm)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Atacado</span>
                                    <span style={{ fontWeight: 600 }}>{formatCurrency(Number(selectedRegister.profitWholesale || 0))}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Mercearia</span>
                                    <span style={{ fontWeight: 600 }}>{formatCurrency(Number(selectedRegister.profitMercearia || 0))}</span>
                                </div>
                            </div>
                        </div>

                        {selectedRegister.notes && (
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>Observações</div>
                                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-sm)', color: 'var(--color-text-secondary)' }}>
                                    {selectedRegister.notes}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default CashRegisterHistoryPage;
