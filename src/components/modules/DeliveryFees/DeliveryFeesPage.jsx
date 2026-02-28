import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit, Trash2, Eye, Truck, FileText, Download } from 'lucide-react';
import Card from '../../common/Card';
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
    const { showNotification } = useApp();
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
    const [collectedTotals, setCollectedTotals] = useState({ totalDeliveryFees: 0, countSalesWithFee: 0 });

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
            for (const s of filtered) {
                const fee = Number(s.deliveryFeeValue || 0);
                if (fee > 0) countSalesWithFee += 1;
                totalDeliveryFees += fee;
            }
            setCollectedTotals({ totalDeliveryFees, countSalesWithFee });
        } catch {
            setCollectedTotals({ totalDeliveryFees: 0, countSalesWithFee: 0 });
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
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold text-red-500">Acesso Negado</h2>
                <p className="text-gray-400">Apenas gerentes podem gerenciar taxas de entrega.</p>
            </div>
        );
    }

    if (loading) return <Loading fullScreen />;

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                <div>
                    <h1>Taxas de Entrega</h1>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        Cadastro, filtros e relatórios
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                    <Button variant="secondary" icon={<FileText size={18} />} onClick={exportPdf} disabled={filteredFees.length === 0}>
                        Exportar PDF
                    </Button>
                    <Button variant="secondary" icon={<Download size={18} />} onClick={exportCsv} disabled={filteredFees.length === 0}>
                        Exportar Excel
                    </Button>
                    <Button variant="primary" icon={<Plus size={18} />} onClick={openCreate}>
                        Nova Taxa
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card title="Resumo" icon={Truck}>
                    <div className="space-y-3 p-4">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Total acumulado</span>
                            <span style={{ fontWeight: 700 }}>{formatCurrency(totals.totalAll)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Total ativo</span>
                            <span style={{ fontWeight: 700 }}>{formatCurrency(totals.totalActive)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Registros</span>
                            <span style={{ fontWeight: 700 }}>{totals.count}</span>
                        </div>
                    </div>
                </Card>

                <Card title="Filtro por Período" icon={Search}>
                    <div className="space-y-3 p-4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                            <DateInput labelPrefix="Início" value={startDate} onChange={setStartDate} />
                            <DateInput labelPrefix="Fim" value={endDate} onChange={setEndDate} />
                        </div>
                        <Input
                            placeholder="Buscar por descrição..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon={<Search size={18} />}
                        />
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                            <Button variant="ghost" onClick={() => { setStartDate(''); setEndDate(''); }}>
                                Limpar Período
                            </Button>
                        </div>
                    </div>
                </Card>

                <Card title="Taxas Aplicadas em Vendas" icon={FileText}>
                    <div className="space-y-3 p-4">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Total (período)</span>
                            <span style={{ fontWeight: 700 }}>
                                {salesTotalsLoading ? '...' : formatCurrency(collectedTotals.totalDeliveryFees)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Vendas com taxa</span>
                            <span style={{ fontWeight: 700 }}>{salesTotalsLoading ? '...' : collectedTotals.countSalesWithFee}</span>
                        </div>
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                            Valores registrados separadamente e excluídos do lucro.
                        </div>
                    </div>
                </Card>
            </div>

            <Card>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Descrição</th>
                                <th>Valor</th>
                                <th>Status</th>
                                <th>Criada em</th>
                                <th style={{ width: '160px', textAlign: 'center' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFees.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                                        Nenhuma taxa encontrada
                                    </td>
                                </tr>
                            ) : (
                                filteredFees.map(fee => (
                                    <tr key={fee.id}>
                                        <td style={{ fontWeight: 600 }}>{fee.description}</td>
                                        <td>{formatCurrency(Number(fee.value || 0))}</td>
                                        <td>
                                            <span style={{ color: (fee.status || 'active') === 'active' ? 'var(--color-success)' : 'var(--color-text-secondary)', fontWeight: 700 }}>
                                                {(fee.status || 'active') === 'active' ? 'Ativa' : 'Inativa'}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--color-text-secondary)' }}>
                                            {toDate(fee.createdAt) ? formatDateTime(toDate(fee.createdAt)) : '-'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-sm)' }}>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={<Eye size={16} />}
                                                    onClick={() => openView(fee)}
                                                    title="Visualizar"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={<Edit size={16} />}
                                                    onClick={() => openEdit(fee)}
                                                    title="Editar"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={<Trash2 size={16} />}
                                                    onClick={() => handleDelete(fee)}
                                                    style={{ color: 'var(--color-danger)' }}
                                                    title="Excluir"
                                                />
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

