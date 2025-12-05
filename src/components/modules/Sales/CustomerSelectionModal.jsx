import React, { useState, useEffect } from 'react';
import { Search, Plus, User } from 'lucide-react';
import Modal from '../../common/Modal';
import Input from '../../common/Input';
import Button from '../../common/Button';
import Loading from '../../common/Loading';
import { customerService } from '../../../services/firestore';

const CustomerSelectionModal = ({ isOpen, onClose, onSelect, onNewCustomer }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filteredCustomers, setFilteredCustomers] = useState([]);

    useEffect(() => {
        if (isOpen) {
            loadCustomers();
            setSearchTerm('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (searchTerm) {
            const filtered = customers.filter(c =>
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.document && c.document.includes(searchTerm)) ||
                (c.phone && c.phone.includes(searchTerm))
            );
            setFilteredCustomers(filtered);
        } else {
            setFilteredCustomers(customers);
        }
    }, [searchTerm, customers]);

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const data = await customerService.getAll();
            setCustomers(data);
            setFilteredCustomers(data);
        } catch (error) {
            console.error('Error loading customers:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Selecionar Cliente"
            size="md"
        >
            <div className="space-y-4">
                <div className="flex gap-2">
                    <div className="flex-1">
                        <Input
                            placeholder="Buscar por nome, CPF ou telefone..."
                            icon={Search}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <Button
                        variant="secondary"
                        onClick={onNewCustomer}
                        icon={Plus}
                    >
                        Novo
                    </Button>
                </div>

                <div className="max-h-96 overflow-y-auto border border-slate-700 rounded-lg">
                    {loading ? (
                        <div className="p-8 flex justify-center">
                            <Loading />
                        </div>
                    ) : filteredCustomers.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            Nenhum cliente encontrado
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-700">
                            {filteredCustomers.map((customer) => (
                                <div
                                    key={customer.id}
                                    onClick={() => onSelect(customer)}
                                    className="p-3 hover:bg-slate-800 cursor-pointer transition-colors flex items-center justify-between group"
                                >
                                    <div>
                                        <div className="font-medium text-white group-hover:text-primary-400 transition-colors">
                                            {customer.name}
                                        </div>
                                        <div className="text-xs text-gray-400 flex gap-2">
                                            {customer.document && <span>{customer.document}</span>}
                                            {customer.phone && <span>• {customer.phone}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-0.5 rounded border ${customer.priceType === 'wholesale'
                                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                            }`}>
                                            {customer.priceType === 'wholesale' ? 'Atacado' : 'Varejo'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default CustomerSelectionModal;
