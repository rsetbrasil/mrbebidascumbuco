import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit, Trash2, Eye, Truck, FileText, Download, DollarSign } from 'lucide-react';
import Button from '../../common/Button';
import Input from '../../common/Input';
import CurrencyInput from '../../common/CurrencyInput';
import Modal from '../../common/Modal';
import DateInput from '../../common/DateInput';
import Loading from '../../common/Loading';
import { deliveryFeeService, salesService } from '../../../services/firestore';
import { useApp } from '../../../contexts/AppContext';
import { useAuth } from '../../../contexts/AuthContext';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import jsPDF from 'jspdf';

const toDate = (v) => {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

const DeliveryFeesPage = () => {
    const { showNotification, currentCashRegister } = useApp();
    const { user, isManager } = useAuth();

    const [loading, setLoading] = useState(true);
    const [fees, setFees] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [viewing, setViewing] = useState(null);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        description: '',
        value: 0,
        status: 'active'
    });

    const [salesTotalsLoading, setSalesTotalsLoading] = useState(false);
    const [collectedTotals, setCollectedTotals] = useState({
        totalDeliveryFees: 0,
        countSalesWithFee: 0,
        currentCashRegisterFees: 0
    });

    useEffect(() => {
        loadFees();
    }, []);

    useEffect(() => {
        loadCollectedTotals();
    }, [startDate, endDate]);

    const loadFees = async () => {
        try {
            setLoading(true);
            const data = await deliveryFeeService.getAll();
            setFees(data || []);
        } catch (e) {
            console.error('Error loading delivery fees:', e);
            showNotification('Erro ao carregar taxas de entrega', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadCollectedTotals = async () => {
        try {
            setSalesTotalsLoading(true);
            const allSales = await salesService.getAll();
            const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
            const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
            const filtered = (allSales || []).filter(s => {
                if (!s || s.status === 'cancelled') return false;
                const d = toDate(s.createdAt);
                if (!d) return false;
                if (start && d < start) return false;
                if (end && d > end) return false;
                return true;
            });
            let totalDeliveryFees = 0;
            let countSalesWithFee = 0;
            let currentCashRegisterFees = 0;
            const currentId = currentCashRegister && currentCashRegister.id ? String(currentCashRegister.id) : null;
            for (const s of filtered) {
                const fee = Number(s.deliveryFeeValue || 0);
                if (fee > 0) countSalesWithFee += 1;
                totalDeliveryFees += fee;
                if (currentId && String(s.cashRegisterId || '') === currentId) {
                    currentCashRegisterFees += fee;
                }
            }
            setCollectedTotals({ totalDeliveryFees, countSalesWithFee, currentCashRegisterFees });
        } catch {
            setCollectedTotals({ totalDeliveryFees: 0, countSalesWithFee: 0, currentCashRegisterFees: 0 });
        } finally {
            setSalesTotalsLoading(false);
        }
    };

    const withinPeriod = (fee) => {
        const d = toDate(fee?.createdAt);
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

    const filteredFees = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return (fees || [])
            .filter(f => (f?.status || 'active') !== 'deleted')
            .filter(f => (term ? String(f?.description || '').toLowerCase().includes(term) : true))
            .filter(f => (startDate || endDate) ? withinPeriod(f) : true)
            .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
    }, [fees, searchTerm, startDate, endDate]);

    const totals = useMemo(() => {
        const all = filteredFees || [];
        const totalAll = all.reduce((sum, f) => sum + Number(f?.value || 0), 0);
        const totalActive = all.filter(f => (f?.status || 'active') === 'active').reduce((sum, f) => sum + Number(f?.value || 0), 0);
        return { totalAll, totalActive, count: all.length };
    }, [filteredFees]);

    const openCreate = () => {
        setEditing(null);
        setForm({ description: '', value: 0, status: 'active' });
        setModalOpen(true);
    };

    const openEdit = (fee) => {
        setEditing(fee);
        setForm({
            description: fee?.description || '',
            value: Number(fee?.value || 0),
            status: fee?.status || 'active'
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditing(null);
        setForm({ description: '', value: 0, status: 'active' });
    };

    const openView = (fee) => {
        setViewing(fee);
        setViewModalOpen(true);
    };

    const closeView = () => {
        setViewModalOpen(false);
        setViewing(null);
    };

    const validate = () => {
        if (!String(form.description || '').trim()) {
            showNotification('Descrição é obrigatória', 'warning');
            return false;
        }
        const v = Number(form.value || 0);
        if (!Number.isFinite(v) || v <= 0) {
            showNotification('Valor deve ser numérico e positivo', 'warning');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        try {
            setSaving(true);
            const payload = {
                description: String(form.description || '').trim(),
                value: Number(form.value || 0),
                status: form.status || 'active',
                updatedBy: user?.name || 'Operador'
            };
            if (editing) {
                await deliveryFeeService.update(editing.id, payload);
                showNotification('Taxa de entrega atualizada', 'success');
            } else {
                await deliveryFeeService.create({
                    ...payload,
                    createdBy: user?.name || 'Operador'
                });
                showNotification('Taxa de entrega criada', 'success');
            }
            closeModal();
            loadFees();
        } catch (err) {
            console.error('Error saving delivery fee:', err);
            showNotification('Erro ao salvar taxa de entrega', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (fee) => {
        if (!fee?.id) return;
        if (!window.confirm('Tem certeza que deseja excluir esta taxa de entrega?')) return;
        try {
            await deliveryFeeService.delete(fee.id);
            showNotification('Taxa de entrega excluída', 'success');
            loadFees();
        } catch (err) {
            console.error('Error deleting delivery fee:', err);
            showNotification('Erro ao excluir taxa de entrega', 'error');
        }
    };

    const exportCsv = () => {
        const rows = filteredFees || [];
        const header = ['Descrição', 'Valor', 'Status', 'Criado em'];
        const statusLabel = (s) => (s === 'inactive' ? 'Inativa' : 'Ativa');
        const lines = [
            header.join(';'),
            ...rows.map(r => [
                String(r?.description || '').replaceAll(';', ','),
                Number(r?.value || 0).toFixed(2).replace('.', ','),
                statusLabel(r?.status || 'active'),
                toDate(r?.createdAt) ? formatDateTime(toDate(r.createdAt)) : ''
            ].join(';'))
        ];
        const csv = '\uFEFF' + lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `taxas-entrega-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const exportPdf = () => {
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const marginX = 40;
        let y = 48;
        const title = 'Relatório - Taxas de Entrega';
        doc.setFontSize(14);
        doc.text(title, marginX, y);
        y += 18;
        doc.setFontSize(10);
        const period = (startDate || endDate)
            ? `Período (criação): ${startDate ? startDate.split('-').reverse().join('/') : '-'} a ${endDate ? endDate.split('-').reverse().join('/') : '-'}`
            : 'Período (criação): todos';
        doc.text(period, marginX, y);
        y += 14;
        doc.text(`Total (filtrado): ${formatCurrency(totals.totalAll)} | Ativas: ${formatCurrency(totals.totalActive)} | Registros: ${totals.count}`, marginX, y);
        y += 18;

        const col = {
            desc: marginX,
            value: marginX + 280,
            status: marginX + 360,
            createdAt: marginX + 440
        };
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text('Descrição', col.desc, y);
        doc.text('Valor', col.value, y);
        doc.text('Status', col.status, y);
        doc.text('Criado em', col.createdAt, y);
        doc.setFont(undefined, 'normal');
        y += 10;
        doc.line(marginX, y, 555, y);
        y += 12;

        const statusLabel = (s) => (s === 'inactive' ? 'Inativa' : 'Ativa');
        const rows = filteredFees || [];
        for (const r of rows) {
            if (y > 780) {
                doc.addPage();
                y = 48;
            }
            const desc = String(r?.description || '').slice(0, 44);
            doc.text(desc, col.desc, y);
            doc.text(formatCurrency(Number(r?.value || 0)), col.value, y, { align: 'left' });
            doc.text(statusLabel(r?.status || 'active'), col.status, y);
            const created = toDate(r?.createdAt);
            doc.text(created ? formatDateTime(created) : '-', col.createdAt, y);
            y += 14;
        }

        doc.save(`taxas-entrega-${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    if (!isManager) {
        return (
            <div style={{ padding: '48px', textAlign: 'center' }}>
                <h2 style={{ color: 'var(--color-danger)', fontWeight: 700 }}>Acesso Negado</h2>
                <p style={{ color: 'var(--color-text-muted)' }}>Apenas gerentes podem gerenciar taxas de entrega.</p>
            </div>
        );
    }

    if (loading) return <Loading fullScreen />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Truck size={14} /> {filteredFees.length} taxa{filteredFees.length !== 1 ? 's' : ''} cadastrada{filteredFees.length !== 1 ? 's' : ''}
                    </div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>Taxas de Entrega</h1>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={exportPdf} disabled={filteredFees.length === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '13px', cursor: filteredFees.length === 0 ? 'not-allowed' : 'pointer', opacity: filteredFees.length === 0 ? 0.5 : 1 }}>
                        <FileText size={15} /> Exportar PDF
                    </button>
                    <button onClick={exportCsv} disabled={filteredFees.length === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '13px', cursor: filteredFees.length === 0 ? 'not-allowed' : 'pointer', opacity: filteredFees.length === 0 ? 0.5 : 1 }}>
                        <Download size={15} /> Exportar Excel
                    </button>
                    <button onClick={openCreate}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', borderRadius: '10px', border: 'none', background: 'var(--gradient-primary)', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
                        <Plus size={16} /> Nova Taxa
                    </button>
                </div>
            </div>

            {/* Info cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {/* Resumo */}
                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Truck size={15} color="var(--color-text-muted)" />
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>Resumo</span>
                    </div>
                    {[
                        { label: 'Total acumulado', value: formatCurrency(totals.totalAll) },
                        { label: 'Total ativo', value: formatCurrency(totals.totalActive) },
                        { label: 'Registros', value: totals.count },
                    ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-divider)' }}>
                            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{row.label}</span>
                            <span style={{ fontWeight: 700, fontSize: '14px' }}>{row.value}</span>
                        </div>
                    ))}
                </div>

                {/* Filtros */}
                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Search size={15} color="var(--color-text-muted)" />
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>Filtrar por Período</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <DateInput labelPrefix="Início" value={startDate} onChange={setStartDate} />
                        <DateInput labelPrefix="Fim" value={endDate} onChange={setEndDate} />
                    </div>
                    <Input
                        placeholder="Buscar por descrição..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        icon={<Search size={16} />}
                    />
                    <button onClick={() => { setStartDate(''); setEndDate(''); setSearchTerm(''); }}
                        style={{ padding: '7px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                        Limpar Período
                    </button>
                </div>

                {/* Vendas */}
                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <DollarSign size={15} color="var(--color-text-muted)" />
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>Taxas Aplicadas em Vendas</span>
                    </div>
                    {[
                        { label: 'Total (período)', value: salesTotalsLoading ? '...' : formatCurrency(collectedTotals.totalDeliveryFees) },
                        { label: 'Vendas com taxa', value: salesTotalsLoading ? '...' : collectedTotals.countSalesWithFee },
                        ...(currentCashRegister ? [{ label: 'Total do caixa aberto', value: salesTotalsLoading ? '...' : formatCurrency(collectedTotals.currentCashRegisterFees || 0) }] : []),
                    ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-divider)' }}>
                            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{row.label}</span>
                            <span style={{ fontWeight: 700, fontSize: '14px' }}>{row.value}</span>
                        </div>
                    ))}
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '10px' }}>
                        Valores registrados separadamente e excluídos do lucro.
                    </p>
                </div>
            </div>

            {/* Tabela */}
            <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                {['Descrição', 'Valor', 'Status', 'Criada em', 'Ações'].map((h, i) => (
                                    <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i === 4 ? 'center' : 'left' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFees.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>
                                        <Truck size={40} style={{ opacity: 0.15, display: 'block', margin: '0 auto 10px' }} />
                                        <p style={{ margin: 0 }}>Nenhuma taxa encontrada</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredFees.map(fee => {
                                    const isActive = (fee.status || 'active') === 'active';
                                    return (
                                        <tr key={fee.id} style={{ borderBottom: '1px solid var(--color-divider)', transition: 'background 0.1s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                                            <td style={{ padding: '13px 16px', fontWeight: 600, fontSize: '14px' }}>{fee.description}</td>
                                            <td style={{ padding: '13px 16px', fontWeight: 700, fontSize: '14px', color: '#22c55e' }}>{formatCurrency(Number(fee.value || 0))}</td>
                                            <td style={{ padding: '13px 16px' }}>
                                                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: isActive ? '#10b98118' : '#94a3b818', color: isActive ? '#10b981' : '#94a3b8' }}>
                                                    {isActive ? 'Ativa' : 'Inativa'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '13px 16px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                                                {toDate(fee.createdAt) ? formatDateTime(toDate(fee.createdAt)) : '-'}
                                            </td>
                                            <td style={{ padding: '13px 16px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                                                    <button onClick={() => openView(fee)} title="Visualizar"
                                                        style={{ padding: '7px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                        <Eye size={15} />
                                                    </button>
                                                    <button onClick={() => openEdit(fee)} title="Editar"
                                                        style={{ padding: '7px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                        <Edit size={15} />
                                                    </button>
                                                    <button onClick={() => handleDelete(fee)} title="Excluir"
                                                        style={{ padding: '7px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={modalOpen}
                onClose={closeModal}
                title={editing ? 'Editar Taxa de Entrega' : 'Nova Taxa de Entrega'}
                size="sm"
            >
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <Input
                        label="Descrição"
                        value={form.description}
                        onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Ex: Entrega Cumbuco"
                        required
                    />
                    <CurrencyInput
                        label="Valor"
                        name="value"
                        value={Number(form.value || 0)}
                        onChange={(e) => setForm(prev => ({ ...prev, value: e.target.value }))}
                        required
                    />
                    <div className="input-group no-margin">
                        <label className="input-label">Status</label>
                        <select
                            className="input-field"
                            value={form.status}
                            onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value }))}
                        >
                            <option value="active">Ativa</option>
                            <option value="inactive">Inativa</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                        <Button variant="ghost" type="button" onClick={closeModal} disabled={saving}>Cancelar</Button>
                        <Button variant="primary" type="submit" loading={saving} disabled={saving}>
                            Salvar
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={viewModalOpen}
                onClose={closeView}
                title="Visualizar Taxa de Entrega"
                size="sm"
            >
                {viewing && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <div>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Descrição</div>
                            <div style={{ fontWeight: 700 }}>{viewing.description}</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Valor</div>
                            <div style={{ fontWeight: 700 }}>{formatCurrency(Number(viewing.value || 0))}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Status</div>
                                <div style={{ fontWeight: 700 }}>{(viewing.status || 'active') === 'active' ? 'Ativa' : 'Inativa'}</div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Criada em</div>
                                <div style={{ fontWeight: 700 }}>{toDate(viewing.createdAt) ? formatDateTime(toDate(viewing.createdAt)) : '-'}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                            <Button variant="secondary" onClick={closeView}>Fechar</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default DeliveryFeesPage;
