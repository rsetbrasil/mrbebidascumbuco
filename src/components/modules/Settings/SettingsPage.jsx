import React, { useState, useEffect } from 'react';
import { Save, Printer, Building, AlertTriangle, Trash2, Package } from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Loading from '../../common/Loading';
import Notification from '../../common/Notification';
import { settingsService, productService } from '../../../services/firestore';
import { useAuth } from '../../../contexts/AuthContext';
import UsersManagement from './UsersManagement';
import UnitsManagement from './UnitsManagement';

const SettingsPage = () => {
    const { isManager } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [notification, setNotification] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkQty, setBulkQty] = useState('');
    const [bulkTarget, setBulkTarget] = useState('stock'); // 'stock' | 'coldStock'
    const [bulkMode, setBulkMode] = useState('set'); // 'set' | 'add'
    const [settings, setSettings] = useState({
        receiptHeader: '',
        receiptFooter: '',
        companyName: '',
        companyAddress: '',
        companyPhone: ''
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
                ...settingsMap
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

    const handleApplyBulkStock = async () => {
        const qty = parseFloat(bulkQty);
        if (isNaN(qty) || qty < 0) {
            showNotification('error', 'Informe uma quantidade válida');
            return;
        }

        const targetLabel = bulkTarget === 'stock' ? 'Estoque Atacado' : 'Estoque Gelado';
        const modeLabel = bulkMode === 'set' ? 'DEFINIR' : 'SOMAR';

        if (!window.confirm(`Confirmar: ${modeLabel} ${targetLabel} para ${qty} em TODOS os produtos?`)) {
            return;
        }

        setBulkLoading(true);
        try {
            const products = await productService.getAll();
            let updated = 0;
            for (const p of products) {
                const current = Number(p[bulkTarget] || 0);
                const next = bulkMode === 'set' ? qty : current + qty;
                await productService.update(p.id, { [bulkTarget]: next });
                updated++;
            }
            showNotification('success', `Quantidade aplicada em ${updated} produto(s)`);
        } catch (error) {
            console.error('Bulk stock update error:', error);
            showNotification('error', 'Erro ao aplicar quantidade em massa');
        } finally {
            setBulkLoading(false);
        }
    };

    const handleDeleteAllProducts = async () => {
        if (!window.confirm('ATENÇÃO: Isso excluirá TODOS os produtos do sistema. Esta ação não pode ser desfeita. Tem certeza?')) {
            return;
        }

        if (!window.confirm('Confirme novamente: Deseja realmente APAGAR TODO O CATÁLOGO DE PRODUTOS?')) {
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
                        </div>
                    </Card>

                    {/* Danger Zone */}
                    <Card title="Zona de Perigo" icon={AlertTriangle} className="border-red-900/50">
                        <div className="space-y-4 p-4">
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                                <h3 className="text-red-400 font-medium mb-2">Excluir Catálogo</h3>
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

                    {/* Estoque em Massa */}
                    <Card title="Estoque em Massa" icon={Package}>
                        <div className="space-y-4 p-4">
                            <p className="text-gray-400 text-sm">
                                Defina ou some uma quantidade de estoque para todos os produtos.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input
                                    label="Quantidade"
                                    name="bulkQty"
                                    type="number"
                                    value={bulkQty}
                                    onChange={(e) => setBulkQty(e.target.value)}
                                    placeholder="Ex: 10"
                                />
                                <div>
                                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                                        Alvo
                                    </label>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                                        <Button
                                            type="button"
                                            variant={bulkTarget === 'stock' ? 'primary' : 'secondary'}
                                            onClick={() => setBulkTarget('stock')}
                                            className="flex-1"
                                        >
                                            Estoque Atacado
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={bulkTarget === 'coldStock' ? 'primary' : 'secondary'}
                                            onClick={() => setBulkTarget('coldStock')}
                                            className="flex-1"
                                        >
                                            Estoque Gelado
                                        </Button>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                                        Modo
                                    </label>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                                        <Button
                                            type="button"
                                            variant={bulkMode === 'set' ? 'primary' : 'secondary'}
                                            onClick={() => setBulkMode('set')}
                                            className="flex-1"
                                        >
                                            Definir
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={bulkMode === 'add' ? 'primary' : 'secondary'}
                                            onClick={() => setBulkMode('add')}
                                            className="flex-1"
                                        >
                                            Somar
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="success"
                                onClick={handleApplyBulkStock}
                                loading={bulkLoading}
                                className="w-full justify-center"
                            >
                                Aplicar nos Produtos
                            </Button>
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
        </div>
    );
};

export default SettingsPage;
