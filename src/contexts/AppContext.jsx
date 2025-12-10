import React, { createContext, useContext, useState, useEffect } from 'react';
import { cashRegisterService, settingsService } from '../services/firestore';

const AppContext = createContext();

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within AppProvider');
    }
    return context;
};

export const AppProvider = ({ children }) => {
    const [currentCashRegister, setCurrentCashRegister] = useState(null);
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        let unsubCash = null;
        let unsubSettings = null;
        try {
            setLoading(true);
            unsubCash = cashRegisterService.subscribeOpen((list) => {
                const current = Array.isArray(list) && list.length > 0 ? list[0] : null;
                setCurrentCashRegister(current);
                setLoading(false);
            });
            unsubSettings = settingsService.subscribeAll((list) => {
                const obj = {};
                (list || []).forEach(s => { obj[s.key] = s.value; });
                setSettings(obj);
            });
        } catch (e) {
            console.error('Error subscribing app data:', e);
            showNotification('Erro ao assinar dados em tempo real', 'error');
            setLoading(false);
        }
        return () => {
            try { unsubCash && unsubCash(); } catch {}
            try { unsubSettings && unsubSettings(); } catch {}
        };
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);

            // Load current cash register
            const cashRegister = await cashRegisterService.getCurrent();
            setCurrentCashRegister(cashRegister);

            // Load settings
            const allSettings = await settingsService.getAll();
            const settingsObj = {};
            allSettings.forEach(setting => {
                settingsObj[setting.key] = setting.value;
            });
            setSettings(settingsObj);

        } catch (error) {
            console.error('Error loading initial data:', error);
            showNotification('Erro ao carregar dados iniciais', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (message, type = 'info') => {
        if (!message) {
            setNotification(null);
            return;
        }
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    };

    const updateSettings = async (key, value) => {
        try {
            await settingsService.set(key, value);
            setSettings(prev => ({ ...prev, [key]: value }));
            showNotification('Configuração atualizada com sucesso', 'success');
        } catch (error) {
            console.error('Error updating setting:', error);
            showNotification('Erro ao atualizar configuração', 'error');
            throw error;
        }
    };

    const openCashRegister = async (openingBalance, openedBy) => {
        try {
            const cashRegister = await cashRegisterService.open({
                openingBalance,
                openedBy
            });
            setCurrentCashRegister(cashRegister);
            showNotification('Caixa aberto com sucesso', 'success');
            return cashRegister;
        } catch (error) {
            console.error('Error opening cash register:', error);
            showNotification('Erro ao abrir caixa', 'error');
            throw error;
        }
    };

    const closeCashRegister = async (closingBalance, closedBy, notes = '') => {
        try {
            if (!currentCashRegister) {
                throw new Error('Nenhum caixa aberto');
            }

            if (!currentCashRegister.id) {
                console.error('Cash register missing ID:', currentCashRegister);
                throw new Error('Erro: ID do caixa não encontrado. Por favor, recarregue a página.');
            }

            const difference = closingBalance - (currentCashRegister.expectedBalance || 0);

            await cashRegisterService.close(currentCashRegister.id, {
                closingBalance,
                closedBy,
                difference,
                notes
            });

            setCurrentCashRegister(null);
            showNotification('Caixa fechado com sucesso', 'success');
        } catch (error) {
            console.error('Error closing cash register:', error);

            // Provide more specific error messages
            if (error.code === 'permission-denied') {
                showNotification('Erro: Permissão negada para fechar o caixa', 'error');
            } else if (error.message.includes('ID do caixa')) {
                showNotification(error.message, 'error');
            } else {
                showNotification('Erro ao fechar caixa. Tente novamente.', 'error');
            }

            throw error;
        }
    };

    const addCashMovement = async (type, amount, description, createdBy) => {
        try {
            if (!currentCashRegister) {
                throw new Error('Nenhum caixa aberto');
            }

            await cashRegisterService.addMovement({
                cashRegisterId: currentCashRegister.id,
                type,
                amount,
                description,
                createdBy
            });

            // Current cash register will update via subscription

            showNotification('Movimento registrado com sucesso', 'success');
        } catch (error) {
            console.error('Error adding cash movement:', error);
            showNotification('Erro ao registrar movimento', 'error');
            throw error;
        }
    };

    const value = {
        currentCashRegister,
        settings,
        loading,
        notification,
        showNotification,
        updateSettings,
        openCashRegister,
        closeCashRegister,
        addCashMovement,
        refreshCashRegister: loadInitialData
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
