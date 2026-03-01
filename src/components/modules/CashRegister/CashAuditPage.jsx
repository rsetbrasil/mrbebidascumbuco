import React, { useEffect, useMemo, useState } from 'react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import DateInput from '../../common/DateInput';
import Loading from '../../common/Loading';
import { useApp } from '../../../contexts/AppContext';
import { useAuth } from '../../../contexts/AuthContext';
import { salesService } from '../../../services/firestore';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { FileText, Download, Search, Filter } from 'lucide-react';
import jsPDF from 'jspdf';

const toDate = (v) => {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

const paymentStatusOf = (sale) => {
    const total = Number(sale?.total || 0);
    const payments = Array.isArray(sale?.payments) ? sale.payments : [];
    const paid = payments.reduce((sum, p) => sum + Number(p?.amount || 0), 0);
    if (paid <= 0) return 'unpaid';
    if (Math.abs(paid - total) < 0.01) return 'paid';
    return 'partial';
};

const CashAuditPage = () => {
    const { showNotification, currentCashRegister } = useApp();
    const { isManager, user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [allSales, setAllSales] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [method, setMethod] = useState('all');
    const [status, setStatus] = useState('all');
    const [query, setQuery] = useState('');
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        loadSales();
    }, []);

    const loadSales = async () => {
        try {
            setLoading(true);
            const sales = await salesService.getAll(1000);
            setAllSales(sales || []);
        } catch (e) {
            showNotification('Erro ao carregar vendas', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filterByPeriod = (sale) => {
        const d = toDate(sale?.createdAt);
        if (!d) return false;
        if (startDate) {
            const s = new Date(`${startDate}T00:00:00`);
            if (d < s) return false;
        }
        if (endDate) {
            const e = new Date(`${endDate}T23:59:59`);
            if (d > e) return false;
        }
        return true;
    };

    const hasMethod = (sale, m) => {
        if (!m || m === 'all') return true;
        const payments = Array.isArray(sale?.payments) ? sale.payments : [];
        if (payments.length === 0) {
            const pm = String(sale?.paymentMethod || '').toLowerCase();
            return pm === m;
        }
        return payments.some(p => String(p?.method || '').toLowerCase() === m);
    };

    const productsValue = (sale) => {
        const fee = Number(sale?.deliveryFeeValue || 0);
        const base = sale?.productsTotal !== undefined ? Number(sale?.productsTotal || 0) : (Number(sale?.total || 0) - fee);
        return Math.max(0, base);
    };

    const filtered = useMemo(() => {
        const term = String(query || '').trim().toLowerCase();
        return (allSales || [])
            .filter(s => s && s.status !== 'cancelled')
            .filter(s => (startDate || endDate) ? filterByPeriod(s) : true)
            .filter(s => (status === 'all') ? true : paymentStatusOf(s) === status)
            .filter(s => hasMethod(s, method))
            .filter(s => {
                if (!term) return true;
                const customer = String(s?.customerName || s?.customer?.name || '').toLowerCase();
                const num = String(s?.saleNumber || s?.id || '').toLowerCase();
                return customer.includes(term) || num.includes(term);
            })
            .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
    }, [allSales, startDate, endDate, method, status, query]);

    const totals = useMemo(() => {
        const list = filtered || [];
        const gross = list.reduce((sum, s) => sum + Number(s?.total || 0), 0);
        const fees = list.reduce((sum, s) => sum + Number(s?.deliveryFeeValue || 0), 0);
        const net = list.reduce((sum, s) => sum + productsValue(s), 0);
        return { gross, fees, net, count: list.length };
    }, [filtered]);

    const exportCsv = () => {
        const rows = filtered || [];
        const header = ['Pedido', 'Data/Hora', 'Cliente', 'Itens', 'Valor Produtos', 'Valor Total', 'Taxa Entrega', 'Pagamentos', 'Status'];
        const formatPayments = (s) => {
            const arr = Array.isArray(s?.payments) ? s.payments : (s?.paymentMethod ? [{ method: s.paymentMethod, amount: Number(s.total || 0) }] : []);
            return arr.map(p => `${p.method}:${Number(p.amount || 0).toFixed(2)}`).join(' | ');
        };
        const lines = [
            header.join(';'),
            ...rows.map(r => [
                String(r?.saleNumber || r?.id || ''),
                toDate(r?.createdAt) ? formatDateTime(toDate(r.createdAt)) : '',
                String(r?.customerName || r?.customer?.name || 'Balcão').replaceAll(';', ','),
                Array.isArray(r?.items) ? r.items.map(i => `${i?.name || i?.productName || ''} x${i?.quantity || 1}`).join(' | ').replaceAll(';', ',') : '',
                productsValue(r).toFixed(2).replace('.', ','),
                Number(r?.total || 0).toFixed(2).replace('.', ','),
                Number(r?.deliveryFeeValue || 0).toFixed(2).replace('.', ','),
                formatPayments(r).replaceAll(';', ','),
                paymentStatusOf(r)
            ].join(';'))
        ];
        const csv = '\uFEFF' + lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auditoria-caixa-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const exportPdf = () => {
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        let y = 48;
        const marginX = 40;
        doc.setFontSize(14);
        doc.text('Relatório de Auditoria do Caixa', marginX, y);
        y += 18;
        doc.setFontSize(10);
        const period = (startDate || endDate)
            ? `Período: ${startDate ? startDate.split('-').reverse().join('/') : '-'} a ${endDate ? endDate.split('-').reverse().join('/') : '-'}`
            : 'Período: todos';
        doc.text(period, marginX, y);
        y += 14;
        const summary = `Registros: ${totals.count} | Bruto: ${formatCurrency(totals.gross)} | Taxas: ${formatCurrency(totals.fees)} | Líquido: ${formatCurrency(totals.net)}`;
        doc.text(summary, marginX, y);
        y += 18;
        const col = { num: marginX, date: marginX + 60, client: marginX + 180, products: marginX + 360, total: marginX + 470 };
        doc.setFont(undefined, 'bold');
        doc.text('Pedido', col.num, y);
        doc.text('Data/Hora', col.date, y);
        doc.text('Cliente', col.client, y);
        doc.text('Produtos', col.products, y);
        doc.text('Liq.', col.total, y);
        doc.setFont(undefined, 'normal');
        y += 10;
        doc.line(marginX, y, 555, y);
        y += 12;
        const rows = filtered || [];
        for (const r of rows) {
            if (y > 780) {
                doc.addPage();
                y = 48;
            }
            const cl = String(r?.customerName || r?.customer?.name || 'Balcão').slice(0, 26);
            const prods = Array.isArray(r?.items) ? r.items.map(i => `${i?.name || i?.productName || ''} x${i?.quantity || 1}`).join(', ').slice(0, 32) : '';
            doc.text(String(r?.saleNumber || r?.id || ''), col.num, y);
            const d = toDate(r?.createdAt);
            doc.text(d ? formatDateTime(d) : '-', col.date, y);
            doc.text(cl, col.client, y);
            doc.text(prods, col.products, y);
            doc.text(formatCurrency(productsValue(r)), col.total, y);
            y += 14;
        }
        doc.save(`auditoria-caixa-${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    if (!(isManager || user?.role === 'cashier')) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold text-red-500">Acesso Negado</h2>
                <p className="text-gray-400">Apenas gerentes e caixas podem acessar a auditoria.</p>
            </div>
        );
    }

    if (loading) return <Loading fullScreen />;

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                <div>
                    <h1>Auditoria do Caixa</h1>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        Lista detalhada de vendas e verificação do caixa
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                    <Button variant="secondary" icon={<FileText size={18} />} onClick={exportPdf} disabled={filtered.length === 0 || exporting}>
                        Exportar PDF
                    </Button>
                    <Button variant="secondary" icon={<Download size={18} />} onClick={exportCsv} disabled={filtered.length === 0 || exporting}>
                        Exportar Excel
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card title="Resumo" icon={Filter}>
                    <div className="space-y-3 p-4">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Bruto no período</span>
                            <span style={{ fontWeight: 700 }}>{formatCurrency(totals.gross)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Taxas de entrega</span>
                            <span style={{ fontWeight: 700 }}>{formatCurrency(totals.fees)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Líquido (produtos/serviços)</span>
                            <span style={{ fontWeight: 700 }}>{formatCurrency(totals.net)}</span>
                        </div>
                        {currentCashRegister && (
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                Caixa aberto: {currentCashRegister.openedAt ? formatDateTime(toDate(currentCashRegister.openedAt)) : currentCashRegister.id}
                            </div>
                        )}
                    </div>
                </Card>

                <Card title="Filtros" icon={Search}>
                    <div className="space-y-3 p-4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                            <DateInput labelPrefix="Início" value={startDate} onChange={setStartDate} />
                            <DateInput labelPrefix="Fim" value={endDate} onChange={setEndDate} />
                        </div>
                        <div className="input-group no-margin">
                            <label className="input-label">Status de pagamento</label>
                            <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="paid">Pago</option>
                                <option value="partial">Parcial</option>
                                <option value="unpaid">Não pago</option>
                            </select>
                        </div>
                        <div className="input-group no-margin">
                            <label className="input-label">Método de pagamento</label>
                            <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="dinheiro">dinheiro</option>
                                <option value="pix">pix</option>
                                <option value="debito">debito</option>
                                <option value="credito">credito</option>
                            </select>
                        </div>
                        <Input
                            placeholder="Buscar por cliente ou número do pedido..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                            <Button variant="ghost" onClick={() => { setStartDate(''); setEndDate(''); setMethod('all'); setStatus('all'); setQuery(''); }}>
                                Limpar filtros
                            </Button>
                        </div>
                    </div>
                </Card>

                <Card title="Regras" icon={FileText}>
                    <div className="space-y-3 p-4" style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        <div>Valores de taxa de entrega são desconsiderados do total do caixa.</div>
                        <div>Use os filtros para conferência e auditoria.</div>
                    </div>
                </Card>
            </div>

            <Card>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Pedido</th>
                                <th>Data/Hora</th>
                                <th>Cliente</th>
                                <th>Itens</th>
                                <th>Produtos</th>
                                <th>Pagamento</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                                        Nenhuma venda encontrada
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(sale => {
                                    const items = Array.isArray(sale?.items) ? sale.items : [];
                                    const payments = Array.isArray(sale?.payments) ? sale.payments : (sale?.paymentMethod ? [{ method: sale.paymentMethod, amount: sale.total }] : []);
                                    return (
                                        <tr key={sale.id}>
                                            <td style={{ fontWeight: 700 }}>{sale.saleNumber || sale.id}</td>
                                            <td style={{ color: 'var(--color-text-secondary)' }}>{toDate(sale.createdAt) ? formatDateTime(toDate(sale.createdAt)) : '-'}</td>
                                            <td>{sale.customerName || sale.customer?.name || 'Balcão'}</td>
                                            <td style={{ maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {items.map(i => `${i?.name || i?.productName || ''} x${i?.quantity || 1}`).join(' | ')}
                                            </td>
                                            <td>{formatCurrency(productsValue(sale))}</td>
                                            <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {payments.map(p => `${p.method}:${formatCurrency(Number(p.amount || 0))}`).join(' | ')}
                                            </td>
                                            <td>
                                                <span style={{ fontWeight: 700, color: paymentStatusOf(sale) === 'paid' ? 'var(--color-success)' : paymentStatusOf(sale) === 'partial' ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                                    {paymentStatusOf(sale) === 'paid' ? 'Pago' : paymentStatusOf(sale) === 'partial' ? 'Parcial' : 'Não pago'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default CashAuditPage;

