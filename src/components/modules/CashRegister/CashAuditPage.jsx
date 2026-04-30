import React, { useEffect, useMemo, useState } from 'react';
import Input from '../../common/Input';
import DateInput from '../../common/DateInput';
import Loading from '../../common/Loading';
import { useApp } from '../../../contexts/AppContext';
import { useAuth } from '../../../contexts/AuthContext';
import { salesService } from '../../../services/firestore';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { FileText, Download, Search, ClipboardList, DollarSign, Truck, Filter } from 'lucide-react';
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

    useEffect(() => { loadSales(); }, []);

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
        if (startDate) { const s = new Date(`${startDate}T00:00:00`); if (d < s) return false; }
        if (endDate) { const e = new Date(`${endDate}T23:59:59`); if (d > e) return false; }
        return true;
    };

    const hasMethod = (sale, m) => {
        if (!m || m === 'all') return true;
        const payments = Array.isArray(sale?.payments) ? sale.payments : [];
        if (payments.length === 0) return String(sale?.paymentMethod || '').toLowerCase() === m;
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
        const csv = '﻿' + lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `auditoria-caixa-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
    };

    const exportPdf = () => {
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        let y = 48; const marginX = 40;
        doc.setFontSize(14); doc.text('Relatório de Auditoria do Caixa', marginX, y); y += 18;
        doc.setFontSize(10);
        const period = (startDate || endDate) ? `Período: ${startDate ? startDate.split('-').reverse().join('/') : '-'} a ${endDate ? endDate.split('-').reverse().join('/') : '-'}` : 'Período: todos';
        doc.text(period, marginX, y); y += 14;
        doc.text(`Registros: ${totals.count} | Bruto: ${formatCurrency(totals.gross)} | Taxas: ${formatCurrency(totals.fees)} | Líquido: ${formatCurrency(totals.net)}`, marginX, y); y += 18;
        const col = { num: marginX, date: marginX + 60, client: marginX + 180, products: marginX + 360, total: marginX + 470 };
        doc.setFont(undefined, 'bold');
        doc.text('Pedido', col.num, y); doc.text('Data/Hora', col.date, y); doc.text('Cliente', col.client, y); doc.text('Produtos', col.products, y); doc.text('Liq.', col.total, y);
        doc.setFont(undefined, 'normal'); y += 10; doc.line(marginX, y, 555, y); y += 12;
        for (const r of (filtered || [])) {
            if (y > 780) { doc.addPage(); y = 48; }
            const cl = String(r?.customerName || r?.customer?.name || 'Balcão').slice(0, 26);
            const prods = Array.isArray(r?.items) ? r.items.map(i => `${i?.name || i?.productName || ''} x${i?.quantity || 1}`).join(', ').slice(0, 32) : '';
            doc.text(String(r?.saleNumber || r?.id || ''), col.num, y);
            const d = toDate(r?.createdAt);
            doc.text(d ? formatDateTime(d) : '-', col.date, y);
            doc.text(cl, col.client, y); doc.text(prods, col.products, y); doc.text(formatCurrency(productsValue(r)), col.total, y);
            y += 14;
        }
        doc.save(`auditoria-caixa-${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    if (!(isManager || user?.role === 'cashier')) {
        return (
            <div style={{ padding: '48px', textAlign: 'center' }}>
                <h2 style={{ color: 'var(--color-danger)', fontWeight: 700 }}>Acesso Negado</h2>
                <p style={{ color: 'var(--color-text-muted)' }}>Apenas gerentes e caixas podem acessar a auditoria.</p>
            </div>
        );
    }

    if (loading) return <Loading fullScreen />;

    const statusBadge = {
        paid: { bg: '#10b98118', color: '#10b981', label: 'Pago' },
        partial: { bg: '#f59e0b18', color: '#f59e0b', label: 'Parcial' },
        unpaid: { bg: '#ef444418', color: '#ef4444', label: 'Não pago' },
    };

    const selectStyle = {
        padding: '9px 12px',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
        fontSize: '13px',
        outline: 'none',
        cursor: 'pointer',
        width: '100%'
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ClipboardList size={14} /> {totals.count} registro{totals.count !== 1 ? 's' : ''} encontrado{totals.count !== 1 ? 's' : ''}
                    </div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>Auditoria do Caixa</h1>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={exportPdf} disabled={filtered.length === 0 || exporting}
                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '13px', cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', opacity: filtered.length === 0 ? 0.5 : 1 }}>
                        <FileText size={15} /> Exportar PDF
                    </button>
                    <button onClick={exportCsv} disabled={filtered.length === 0 || exporting}
                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '13px', cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', opacity: filtered.length === 0 ? 0.5 : 1 }}>
                        <Download size={15} /> Exportar Excel
                    </button>
                </div>
            </div>

            {/* Summary + Filters grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {/* Resumo */}
                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <DollarSign size={15} color="var(--color-text-muted)" />
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>Resumo</span>
                    </div>
                    {[
                        { label: 'Bruto no período', value: formatCurrency(totals.gross) },
                        { label: 'Taxas de entrega', value: formatCurrency(totals.fees) },
                        { label: 'Líquido (produtos)', value: formatCurrency(totals.net) },
                    ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-divider)' }}>
                            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{row.label}</span>
                            <span style={{ fontWeight: 700, fontSize: '14px' }}>{row.value}</span>
                        </div>
                    ))}
                    {currentCashRegister && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '10px' }}>
                            Caixa aberto: {currentCashRegister.openedAt ? formatDateTime(toDate(currentCashRegister.openedAt)) : currentCashRegister.id}
                        </div>
                    )}
                </div>

                {/* Filtros */}
                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Filter size={15} color="var(--color-text-muted)" />
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>Filtros</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <DateInput labelPrefix="Início" value={startDate} onChange={setStartDate} />
                        <DateInput labelPrefix="Fim" value={endDate} onChange={setEndDate} />
                    </div>
                    <select style={selectStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="all">Status: Todos</option>
                        <option value="paid">Pago</option>
                        <option value="partial">Parcial</option>
                        <option value="unpaid">Não pago</option>
                    </select>
                    <select style={selectStyle} value={method} onChange={(e) => setMethod(e.target.value)}>
                        <option value="all">Pagamento: Todos</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="pix">PIX</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                    </select>
                    <button onClick={() => { setStartDate(''); setEndDate(''); setMethod('all'); setStatus('all'); setQuery(''); }}
                        style={{ padding: '7px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                        Limpar filtros
                    </button>
                </div>

                {/* Regras */}
                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Truck size={15} color="var(--color-text-muted)" />
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>Observações</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                        <p style={{ margin: '0 0 8px' }}>Valores de taxa de entrega são desconsiderados do total do caixa.</p>
                        <p style={{ margin: 0 }}>Use os filtros para conferência e auditoria detalhada.</p>
                    </div>
                </div>
            </div>

            {/* Busca */}
            <div style={{ maxWidth: '400px' }}>
                <Input
                    placeholder="Buscar por cliente ou número do pedido..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    icon={<Search size={16} />}
                />
            </div>

            {/* Tabela */}
            <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                {['Pedido', 'Data/Hora', 'Cliente', 'Itens', 'Produtos', 'Pagamento', 'Status'].map((h, i) => (
                                    <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i === 6 ? 'center' : 'left' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>
                                        <ClipboardList size={40} style={{ opacity: 0.15, display: 'block', margin: '0 auto 10px' }} />
                                        <p style={{ margin: 0 }}>Nenhuma venda encontrada</p>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(sale => {
                                    const items = Array.isArray(sale?.items) ? sale.items : [];
                                    const payments = Array.isArray(sale?.payments) ? sale.payments : (sale?.paymentMethod ? [{ method: sale.paymentMethod, amount: sale.total }] : []);
                                    const pStatus = paymentStatusOf(sale);
                                    const badge = statusBadge[pStatus] || statusBadge.unpaid;
                                    return (
                                        <tr key={sale.id} style={{ borderBottom: '1px solid var(--color-divider)', transition: 'background 0.1s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                                            <td style={{ padding: '13px 16px', fontWeight: 700, fontSize: '13px' }}>{sale.saleNumber || sale.id}</td>
                                            <td style={{ padding: '13px 16px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>{toDate(sale.createdAt) ? formatDateTime(toDate(sale.createdAt)) : '-'}</td>
                                            <td style={{ padding: '13px 16px', fontWeight: 600, fontSize: '13px' }}>{sale.customerName || sale.customer?.name || 'Balcão'}</td>
                                            <td style={{ padding: '13px 16px', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                                                {items.map(i => `${i?.name || i?.productName || ''} x${i?.quantity || 1}`).join(' · ')}
                                            </td>
                                            <td style={{ padding: '13px 16px', fontWeight: 600, fontSize: '13px' }}>{formatCurrency(productsValue(sale))}</td>
                                            <td style={{ padding: '13px 16px', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                                {payments.map(p => `${p.method}: ${formatCurrency(Number(p.amount || 0))}`).join(' · ')}
                                            </td>
                                            <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                                                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: badge.bg, color: badge.color }}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CashAuditPage;
