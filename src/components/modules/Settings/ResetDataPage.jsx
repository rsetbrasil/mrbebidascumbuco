import React, { useState } from 'react';
import { Trash2, AlertTriangle, Database } from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Modal from '../../common/Modal';
import { useApp } from '../../../contexts/AppContext';
import { salesService, cashRegisterService, counterService, firestoreService, COLLECTIONS } from '../../../services/firestore';

const ResetDataPage = () => {
    const { showNotification } = useApp();
    const [confirmModal, setConfirmModal] = useState({ open: false, type: '', title: '', message: '' });
    const [processing, setProcessing] = useState(false);

    const handleResetSales = async () => {
        setProcessing(true);
        try {
            // Get all sales
            const sales = await salesService.getAll(10000); // Get all

            // Delete all sales
            for (const sale of sales) {
                await firestoreService.delete(COLLECTIONS.SALES, sale.id);
            }

            // Reset sale number counter
            await counterService.reset('saleNumber');

            showNotification('Vendas zeradas com sucesso! Próxima venda será número 1.', 'success');
            setConfirmModal({ open: false, type: '', title: '', message: '' });
        } catch (error) {
            console.error('Error resetting sales:', error);
            showNotification('Erro ao zerar vendas', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const handleResetCashRegister = async () => {
        setProcessing(true);
        try {
            // Get all cash registers
            const registers = await cashRegisterService.getAll();

            // Close all open registers and delete all
            for (const register of registers) {
                if (register.status === 'open') {
                    await cashRegisterService.close(register.id, {
                        finalBalance: register.openingBalance || 0,
                        closedBy: 'Sistema'
                    });
                }
                await firestoreService.delete(COLLECTIONS.CASH_REGISTER, register.id);
            }

            // Get all movements
            const allMovements = await firestoreService.getAll(COLLECTIONS.CASH_MOVEMENTS);
            for (const movement of allMovements) {
                await firestoreService.delete(COLLECTIONS.CASH_MOVEMENTS, movement.id);
            }

            showNotification('Caixa zerado com sucesso!', 'success');
            setConfirmModal({ open: false, type: '', title: '', message: '' });
        } catch (error) {
            console.error('Error resetting cash register:', error);
            showNotification('Erro ao zerar caixa', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const handleResetPresales = async () => {
        setProcessing(true);
        try {
            // Get all presales
            const presales = await firestoreService.getAll(COLLECTIONS.PRESALES);

            // Delete all presales
            for (const presale of presales) {
                await firestoreService.delete(COLLECTIONS.PRESALES, presale.id);
            }

            showNotification('Pré-vendas zeradas com sucesso!', 'success');
            setConfirmModal({ open: false, type: '', title: '', message: '' });
        } catch (error) {
            console.error('Error resetting presales:', error);
            showNotification('Erro ao zerar pré-vendas', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const handleResetAll = async () => {
        setProcessing(true);
        try {
            await handleResetSales();
            await handleResetCashRegister();
            await handleResetPresales();

            showNotification('Todos os dados foram zerados com sucesso!', 'success');
            setConfirmModal({ open: false, type: '', title: '', message: '' });
        } catch (error) {
            console.error('Error resetting all data:', error);
            showNotification('Erro ao zerar dados', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const openConfirmModal = (type, title, message, action) => {
        setConfirmModal({
            open: true,
            type,
            title,
            message,
            action
        });
    };

    const resetActions = [
        {
            id: 'sales',
            title: 'Zerar Vendas',
            description: 'Remove todas as vendas e reseta a numeração para 1',
            icon: Database,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            action: () => openConfirmModal(
                'sales',
                'Zerar Vendas',
                'Tem certeza que deseja zerar TODAS as vendas? Esta ação não pode ser desfeita! A numeração de vendas será resetada para 1.',
                handleResetSales
            )
        },
        {
            id: 'cash',
            title: 'Zerar Caixa',
            description: 'Fecha caixas abertos e remove todas as movimentações',
            icon: Database,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            action: () => openConfirmModal(
                'cash',
                'Zerar Caixa',
                'Tem certeza que deseja zerar TODO o caixa? Todos os caixas abertos serão fechados e as movimentações removidas. Esta ação não pode ser desfeita!',
                handleResetCashRegister
            )
        },
        {
            id: 'presales',
            title: 'Zerar Pré-Vendas',
            description: 'Remove todas as pré-vendas do sistema',
            icon: Database,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            action: () => openConfirmModal(
                'presales',
                'Zerar Pré-Vendas',
                'Tem certeza que deseja zerar TODAS as pré-vendas? Esta ação não pode ser desfeita!',
                handleResetPresales
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Resetar Dados</h1>
                    <p className="text-gray-600 mt-1">Gerencie e limpe os dados do sistema</p>
                </div>
            </div>

            {/* Warning Alert */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                            <strong>Atenção:</strong> As operações abaixo são irreversíveis.
                            Certifique-se de fazer backup dos dados antes de prosseguir.
                        </p>
                    </div>
                </div>
            </div>

            {/* Reset Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {resetActions.map((action) => (
                    <Card key={action.id}>
                        <div className="flex items-start space-x-4">
                            <div className={`p-3 rounded-lg ${action.bgColor}`}>
                                <action.icon className={`h-6 w-6 ${action.color}`} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900">{action.title}</h3>
                                <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                                <Button
                                    variant="outline"
                                    onClick={action.action}
                                    className="mt-4"
                                    disabled={processing}
                                >
                                    {action.title}
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Confirmation Modal */}
            <Modal
                isOpen={confirmModal.open}
                onClose={() => !processing && setConfirmModal({ open: false, type: '', title: '', message: '' })}
                title={confirmModal.title}
            >
                <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                        <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-gray-700">{confirmModal.message}</p>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setConfirmModal({ open: false, type: '', title: '', message: '' })}
                            disabled={processing}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="danger"
                            onClick={confirmModal.action}
                            disabled={processing}
                        >
                            {processing ? 'Processando...' : 'Confirmar'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ResetDataPage;
