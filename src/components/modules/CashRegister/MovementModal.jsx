import React, { useState } from 'react';
import { Save, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import Input from '../../common/Input';
import CurrencyInput from '../../common/CurrencyInput';
import Button from '../../common/Button';
import { parseCurrency } from '../../../utils/formatters';

const MovementModal = ({ isOpen, onClose, onSave, type = 'supply' }) => {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isSupply = type === 'supply';
    const title = isSupply ? 'Adicionar Suprimento' : 'Realizar Sangria';

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount) {
            setError('Valor é obrigatório');
            return;
        }

        setLoading(true);
        try {
            await onSave({
                type,
                amount: parseFloat(amount) || 0,
                description: description || (isSupply ? 'Suprimento de caixa' : 'Sangria de caixa')
            });
            onClose();
            setAmount('');
            setDescription('');
        } catch (err) {
            console.error('Error saving movement:', err);
            setError('Erro ao salvar movimentação');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                    {isSupply ? (
                        <ArrowUpCircle className="text-emerald-500" size={32} />
                    ) : (
                        <ArrowDownCircle className="text-red-500" size={32} />
                    )}
                    <div>
                        <p className="text-sm text-gray-400">Tipo de Movimentação</p>
                        <p className={`font-medium ${isSupply ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isSupply ? 'Entrada (Suprimento)' : 'Saída (Sangria)'}
                        </p>
                    </div>
                </div>

                <CurrencyInput
                    label="Valor (R$)"
                    value={amount}
                    onChange={(e) => {
                        setAmount(e.target.value);
                        setError('');
                    }}
                    placeholder="0,00"
                    error={error}
                    autoFocus
                />

                <Input
                    label="Descrição / Motivo"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={isSupply ? "Ex: Troco inicial" : "Ex: Pagamento de fornecedor"}
                    textarea
                />

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700 mt-6">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant={isSupply ? 'success' : 'danger'}
                        loading={loading}
                        icon={Save}
                    >
                        Confirmar
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default MovementModal;
