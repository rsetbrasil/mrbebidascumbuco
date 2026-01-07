import React, { useState, useEffect } from 'react';
import { Save, Printer, Building, AlertTriangle, Trash2, Settings, Upload, Download, CreditCard } from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Loading from '../../common/Loading';
import Notification from '../../common/Notification';
import { settingsService, productService, categoryService, presalesService } from '../../../services/firestore';
import { useAuth } from '../../../contexts/AuthContext';
import UsersManagement from './UsersManagement';
import UnitsManagement from './UnitsManagement';
import ImportProductsModal from '../Products/ImportProductsModal';

const SettingsPage = () => {
    const { isManager } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [notification, setNotification] = useState(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [settings, setSettings] = useState({
        receiptHeader: '',
        receiptFooter: '',
        companyName: '',
        companyAddress: '',
        companyPhone: '',
        brandLogoUrl: '',
        socialInstagram: '',
        whatsapp: '',
        cashRegisterAutoCloseTime: '22:00',
        allowSaleWithoutStock: true,
        creditCardFee: '3.5',
        debitCardFee: '2.5',
        menu: [
            { key: 'dashboard', visible: true, label: 'Painel' },
            { key: 'pdv', visible: true, label: 'PDV' },
            { key: 'sales', visible: true, label: 'Vendas' },
            { key: 'products', visible: true, label: 'Produtos' },
            { key: 'categories', visible: true, label: 'Categorias' },
            { key: 'customers', visible: true, label: 'Clientes' },
            { key: 'cashRegister', visible: true, label: 'Caixa' },
            { key: 'presales', visible: true, label: 'Pré-vendas' },
            { key: 'financial', visible: true, label: 'Financeiro' },
            { key: 'settings', visible: true, label: 'Configurações' },
            { key: 'resetData', visible: true, label: 'Resetar Dados' }
        ]
    });
    const [devDemoEnabled, setDevDemoEnabled] = useState(() => {
        try { return localStorage.getItem('pdv_force_demo') === 'true'; } catch { return false; }
    });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const allSettings = await settingsService.getAll();
            const settingsMap = {};
            allSettings.forEach(s => settingsMap[s.key] = s.value);

            setSettings(prev => ({
                ...prev,
                ...settingsMap,
                creditCardFee: settingsMap.creditCardFee || '3.5',
                debitCardFee: settingsMap.debitCardFee || '2.5'
            }));
        } catch (error) {
            console.error('Error loading settings:', error);
            showNotification('error', 'Erro ao carregar configurações');
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const moveMenuItem = (index, direction) => {
        setSettings(prev => {
            const arr = Array.isArray(prev.menu) ? [...prev.menu] : [];
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= arr.length) return prev;
            const tmp = arr[index];
            arr[index] = arr[newIndex];
            arr[newIndex] = tmp;
            return { ...prev, menu: arr };
        });
    };

    const toggleMenuItem = (index) => {
        setSettings(prev => {
            const arr = Array.isArray(prev.menu) ? [...prev.menu] : [];
            arr[index] = { ...arr[index], visible: !arr[index].visible };
            return { ...prev, menu: arr };
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Save each setting individually
            const promises = Object.entries(settings).map(([key, value]) =>
                settingsService.set(key, value)
            );

            await Promise.all(promises);
            showNotification('success', 'Configurações salvas com sucesso');
        } catch (error) {
            console.error('Error saving settings:', error);
            showNotification('error', 'Erro ao salvar configurações');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAllProducts = async () => {
        if (!window.confirm('ATENÇÃO: Isso excluirá TODOS os produtos do sistema. Esta ação não pode ser desfeita. Tem certeza?')) {
            return;
        }

        if (!window.confirm('Confirme novamente: Deseja realmente APAGAR TODOS OS PRODUTOS?')) {
            return;
        }

        setDeleting(true);
        try {
            await productService.deleteAll();
            showNotification('success', 'Todos os produtos foram excluídos com sucesso.');
        } catch (error) {
            console.error('Error deleting all products:', error);
            showNotification('error', 'Erro ao excluir produtos.');
        } finally {
            setDeleting(false);
        }
    };

    const handleCancelAllPresales = async () => {
        if (!window.confirm('ATENÇÃO: Isso cancelará TODOS os pedidos da pré-venda e liberará os estoques reservados. Tem certeza?')) {
            return;
        }
        if (!window.confirm('Confirme novamente: Deseja realmente CANCELAR todas as pré-vendas pendentes?')) {
            return;
        }
        setCancelling(true);
        try {
            const result = await presalesService.cancelAll();
            const cancelled = Number(result?.cancelled || 0);
            const releasedProducts = Number(result?.releasedProducts || 0);
            showNotification('success', `Pré-vendas canceladas: ${cancelled}. Produtos atualizados: ${releasedProducts}.`);
        } catch (error) {
            console.error('Error cancelling presales:', error);
            showNotification('error', 'Erro ao cancelar pré-vendas.');
        } finally {
            setCancelling(false);
        }
    };

    if (loading) return <Loading fullScreen />;

    if (!isManager) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold text-red-500">Acesso Negado</h2>
                <p className="text-gray-400">Apenas gerentes podem acessar as configurações.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {notification && (
                <Notification
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}

            <div>
                <h1 className="text-2xl font-bold text-white">Configurações</h1>
                <p className="text-gray-400">Personalize o sistema e gerencie usuários</p>
            </div>

            {/* Users Management Section */}
            <UsersManagement />

            {/* Units Management Section */}
            <UnitsManagement />

            <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Receipt Settings */}
                    <Card title="Cupom Fiscal" icon={Printer}>
                        <div className="space-y-4 p-4">
                            <Input
                                label="Cabeçalho do Cupom"
                                name="receiptHeader"
                                value={settings.receiptHeader}
                                onChange={handleChange}
                                placeholder="Ex: MR BEBIDAS\nRua Exemplo, 123"
                                textarea
                                rows={4}
                                helperText="Use Enter para quebrar linhas"
                            />

                            <Input
                                label="Rodapé do Cupom"
                                name="receiptFooter"
                                value={settings.receiptFooter}
                                onChange={handleChange}
                                placeholder="Ex: Obrigado pela preferência!"
                                textarea
                                rows={3}
                            />
                        </div>
                    </Card>

                    {/* Company Info */}
                    <Card title="Dados da Empresa" icon={Building}>
                        <div className="space-y-4 p-4">
                            <Input
                                label="Logo (URL)"
                                name="brandLogoUrl"
                                value={settings.brandLogoUrl}
                                onChange={handleChange}
                                placeholder="https://.../logo.png"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Nome da Empresa"
                                    name="companyName"
                                    value={settings.companyName}
                                    onChange={handleChange}
                                    placeholder="Ex: MR Bebidas Ltda"
                                />

                                <Input
                                    label="Telefone / Contato"
                                    name="companyPhone"
                                    value={settings.companyPhone}
                                    onChange={handleChange}
                                    placeholder="(00) 0000-0000"
                                />
                            </div>

                            <Input
                                label="Endereço Completo"
                                name="companyAddress"
                                value={settings.companyAddress}
                                onChange={handleChange}
                                placeholder="Rua, Número, Bairro, Cidade - UF"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Instagram"
                                    name="socialInstagram"
                                    value={settings.socialInstagram}
                                    onChange={handleChange}
                                    placeholder="@seuinstagram"
                                />
                                <Input
                                    label="WhatsApp"
                                    name="whatsapp"
                                    value={settings.whatsapp}
                                    onChange={handleChange}
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Taxas de Cartão */}
                    <Card title="Taxas de Pagamento" icon={CreditCard}>
                        <div className="space-y-4 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Taxa Cartão de Crédito (%)"
                                    name="creditCardFee"
                                    type="number"
                                    value={settings.creditCardFee}
                                    onChange={handleChange}
                                    placeholder="0"
                                    step="0.01"
                                />
                                <Input
                                    label="Taxa Cartão de Débito (%)"
                                    name="debitCardFee"
                                    type="number"
                                    value={settings.debitCardFee}
                                    onChange={handleChange}
                                    placeholder="0"
                                    step="0.01"
                                />
                            </div>
                            <p className="text-sm text-gray-400">
                                Estas taxas serão sugeridas automaticamente ao finalizar uma venda com cartão.
                            </p>
                        </div>
                    </Card>

                    <Card title="Caixa" icon={Settings}>
                        <div className="space-y-4 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Fechamento automático do caixa"
                                    name="cashRegisterAutoCloseTime"
                                    type="time"
                                    value={settings.cashRegisterAutoCloseTime || '22:00'}
                                    onChange={handleChange}
                                />
                            </div>
                            <p className="text-sm text-gray-400">
                                Se o caixa estiver aberto, será fechado automaticamente no horário configurado.
                            </p>
                        </div>
                    </Card>

                    <Card title="Estoque" icon={Settings}>
                        <div className="space-y-4 p-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="allowSaleWithoutStock"
                                    checked={!!settings.allowSaleWithoutStock}
                                    onChange={(e) => {
                                        const { checked } = e.target;
                                        setSettings(prev => ({ ...prev, allowSaleWithoutStock: checked }));
                                    }}
                                />
                                <span>Permitir vender sem estoque</span>
                            </label>
                            <p className="text-sm text-gray-400">
                                Ao ativar, o sistema não bloqueia vendas ou reservas quando o estoque disponível é insuficiente.
                            </p>
                        </div>
                    </Card>

                    <Card title="Menu" icon={Settings}>
                        <div className="space-y-2 p-4">
                            {Array.isArray(settings.menu) && settings.menu.map((item, idx) => (
                                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '180px' }}>{item.label}</div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button type="button" onClick={() => moveMenuItem(idx, 'up')} style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>↑</button>
                                        <button type="button" onClick={() => moveMenuItem(idx, 'down')} style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>↓</button>
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input type="checkbox" checked={!!item.visible} onChange={() => toggleMenuItem(idx)} />
                                        <span>Visível</span>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card title="Desenvolvimento" icon={AlertTriangle}>
                        <div className="space-y-4 p-4">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    checked={devDemoEnabled}
                                    onChange={(e) => {
                                        const val = e.target.checked;
                                        setDevDemoEnabled(val);
                                        try {
                                            if (val) localStorage.setItem('pdv_force_demo', 'true');
                                            else localStorage.removeItem('pdv_force_demo');
                                        } catch {}
                                        showNotification('success', 'Modo Demo local atualizado. Recarregue a página para aplicar.');
                                    }}
                                />
                                <span>Modo Demo local (desativar Firestore no preview)</span>
                            </label>
                            <p className="text-gray-400 text-sm">Ao ativar, o sistema usa dados internos e evita conexões com o Firestore durante o desenvolvimento.</p>
                        </div>
                    </Card>

                    <Card title="Produtos: Importação/Exportação" icon={Settings}>
                        <div className="space-y-4 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setIsImportModalOpen(true)}
                                    icon={Upload}
                                    className="w-full justify-center"
                                >
                                    Importar CSV de Produtos
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={async () => {
                                        setLoading(true);
                                        try {
                                            const [products, categories] = await Promise.all([
                                                productService.getAll(),
                                                categoryService.getAll()
                                            ]);
                                            const catMap = {};
                                            categories.forEach(c => { catMap[c.id] = c.name; });
                                            const headers = [
                                                'nome','codigo','preco','custo','estoque','categoria',
                                                'preco_mercearia','custo_mercearia','estoque_mercearia',
                                                'unidade','unidade_mercearia'
                                            ];
                                            const escapeCSV = (v) => {
                                                const s = String(v ?? '');
                                                if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
                                                return s;
                                            };
                                            const rows = products.map(p => [
                                                p.name || '',
                                                p.barcode || '',
                                                (p.wholesalePrice ?? p.price ?? 0),
                                                (p.cost ?? 0),
                                                (p.stock ?? 0),
                                                catMap[p.categoryId] || '',
                                                (p.coldPrice ?? 0),
                                                (p.coldCost ?? 0),
                                                (p.coldStock ?? 0),
                                                p.wholesaleUnit || p.unitOfMeasure || '',
                                                p.coldUnit || p.unitOfMeasure || ''
                                            ]);
                                            const csv = [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
                                            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                            const url = window.URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `produtos-${new Date().toISOString().slice(0,10)}.csv`;
                                            document.body.appendChild(a);
                                            a.click();
                                            window.URL.revokeObjectURL(url);
                                            document.body.removeChild(a);
                                            showNotification('success', 'Exportação concluída');
                                        } catch (error) {
                                            console.error('Export error:', error);
                                            showNotification('error', 'Erro ao exportar produtos');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    icon={Download}
                                    className="w-full justify-center"
                                >
                                    Exportar Produtos (CSV)
                                </Button>
                            </div>
                        </div>
                    </Card>

                    {/* Danger Zone */}
                    <Card title="Zona de Perigo" icon={AlertTriangle} className="border-red-900/50">
                        <div className="space-y-4 p-4">
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                                <h3 className="text-red-400 font-medium mb-2">Excluir Produtos</h3>
                                <p className="text-red-300/70 text-sm mb-4">
                                    Esta ação irá apagar permanentemente todos os produtos cadastrados.
                                    Use com extrema cautela.
                                </p>
                                <Button
                                    type="button"
                                    variant="danger"
                                    onClick={handleDeleteAllProducts}
                                    loading={deleting}
                                    icon={Trash2}
                                    className="w-full justify-center"
                                >
                                    Excluir Todos os Produtos
                                </Button>
                            </div>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                                <h3 className="text-red-400 font-medium mb-2">Cancelar Pré-vendas</h3>
                                <p className="text-red-300/70 text-sm mb-4">
                                    Cancela todas as pré-vendas pendentes e libera o estoque reservado (Atacado e Mercearia).
                                </p>
                                <Button
                                    type="button"
                                    variant="danger"
                                    onClick={handleCancelAllPresales}
                                    loading={cancelling}
                                    icon={AlertTriangle}
                                    className="w-full justify-center"
                                >
                                    Cancelar todos os pedidos da Pré-venda
                                </Button>
                            </div>
                        </div>
                    </Card>
                    {/* Backup & Data */}
                    <Card title="Backup & Dados" icon={Save}>
                        <div className="space-y-4 p-4">
                            <p className="text-gray-400 text-sm">
                                Faça o download de todos os dados do sistema (produtos, clientes, vendas, etc.) para sua segurança.
                            </p>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={async () => {
                                    setLoading(true);
                                    try {
                                        const { backupService } = await import('../../../services/firestore');
                                        const data = await backupService.createBackup();

                                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `backup-pdv-${new Date().toISOString().slice(0, 10)}.json`;
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        document.body.removeChild(a);

                                        showNotification('success', 'Backup realizado com sucesso!');
                                    } catch (error) {
                                        console.error('Backup error:', error);
                                        showNotification('error', 'Erro ao gerar backup');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                icon={Save}
                                className="w-full justify-center"
                            >
                                Fazer Backup do Sistema
                            </Button>

                            <div className="border-t border-slate-700 pt-4 mt-4">
                                <p className="text-red-400 text-sm font-medium mb-2">
                                    ⚠️ Restaurar Backup
                                </p>
                                <p className="text-gray-400 text-xs mb-3">
                                    ATENÇÃO: Isso substituirá TODOS os dados atuais pelos dados do arquivo de backup.
                                </p>
                                <input
                                    type="file"
                                    accept=".json"
                                    id="backup-file"
                                    style={{ display: 'none' }}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        if (!window.confirm('⚠️ ATENÇÃO: Restaurar o backup irá SUBSTITUIR TODOS OS DADOS ATUAIS do sistema. Esta ação NÃO pode ser desfeita. Deseja continuar?')) {
                                            e.target.value = '';
                                            return;
                                        }

                                        if (!window.confirm('Confirme novamente: Tem CERTEZA que deseja SUBSTITUIR todos os dados atuais?')) {
                                            e.target.value = '';
                                            return;
                                        }

                                        setLoading(true);
                                        try {
                                            const text = await file.text();
                                            const backupData = JSON.parse(text);

                                            const { backupService } = await import('../../../services/firestore');
                                            const results = await backupService.restoreBackup(backupData);

                                            if (results.errors.length > 0) {
                                                console.error('Restore errors:', results.errors);
                                                showNotification('error', `Backup restaurado com alguns erros. Verifique o console.`);
                                            } else {
                                                showNotification('success', 'Backup restaurado com sucesso! Recarregue a página.');
                                            }
                                        } catch (error) {
                                            console.error('Restore error:', error);
                                            showNotification('error', 'Erro ao restaurar backup: ' + error.message);
                                        } finally {
                                            setLoading(false);
                                            e.target.value = '';
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="danger"
                                    onClick={() => {
                                        document.getElementById('backup-file')?.click();
                                    }}
                                    icon={AlertTriangle}
                                    className="w-full justify-center"
                                >
                                    Restaurar Backup
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="flex justify-end">
                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        loading={saving}
                        icon={Save}
                    >
                        Salvar Alterações
                    </Button>
                </div>
            </form>
            <ImportProductsModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImportSuccess={(successCount, errorCount) => {
                    setIsImportModalOpen(false);
                    showNotification('success', `${successCount} produtos importados`);
                    if (errorCount > 0) {
                        setTimeout(() => showNotification('warning', `${errorCount} itens falharam`), 2000);
                    }
                }}
            />
        </div>
    );
};

export default SettingsPage;
