import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { cashRegisterService, settingsService } from '../services/firestore';
import { salesService } from '../services/firestore';

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
    const [isSyncing, setIsSyncing] = useState(false);
    const reloadTokenRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const lastActivityRef = useRef(Date.now());

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

    useEffect(() => {
        const markActivity = () => { lastActivityRef.current = Date.now(); };
        if (typeof window !== 'undefined') {
            ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt =>
                window.addEventListener(evt, markActivity, { passive: true })
            );
        }
        const interval = setInterval(() => {
            const hasOpenCash = !!(currentCashRegister && currentCashRegister.id);
            const idleThresholdMs = 45 * 1000;
            const isIdle = (Date.now() - (lastActivityRef.current || 0)) > idleThresholdMs;
            if (hasOpenCash && isIdle && !busy && !isSyncing) {
                try {
                    if (typeof window !== 'undefined') {
                        window.location.reload();
                    }
                } catch {}
            }
        }, 10 * 60 * 1000);
        return () => {
            clearInterval(interval);
            if (typeof window !== 'undefined') {
                ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt =>
                    window.removeEventListener(evt, markActivity)
                );
            }
        };
    }, [currentCashRegister, busy, isSyncing]);

    useEffect(() => {
        const runNormalize = async () => {
            setIsSyncing(true);
            try {
                const count = await salesService.normalizeProvisional();
                if (count > 0) {
                    showNotification(`Sincronização concluída (${count} venda${count > 1 ? 's' : ''})`, 'success');
                } else {
                    showNotification('Nada a sincronizar', 'info');
                }
            } finally {
                setIsSyncing(false);
            }
        };
        const handleOnline = () => {
            runNormalize().catch(() => {});
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('online', handleOnline);
        }
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            runNormalize().catch(() => {});
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('online', handleOnline);
            }
        };
    }, []);

    useEffect(() => {
        const token = settings && settings.reloadToken;
        if (token === undefined || token === null) {
            reloadTokenRef.current = token;
            return;
        }
        if (reloadTokenRef.current !== null && reloadTokenRef.current !== undefined && token !== reloadTokenRef.current) {
            try {
                if (typeof window !== 'undefined') {
                    window.location.reload();
                }
            } catch {}
        }
        reloadTokenRef.current = token;
    }, [settings.reloadToken]);

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

    const closeCashRegister = async (closingBalance, closedBy, notes = '', extras = {}) => {
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
                notes,
                ...extras
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
        isSyncing,
        busy,
        showNotification,
        updateSettings,
        openCashRegister,
        closeCashRegister,
        addCashMovement,
        refreshCashRegister: loadInitialData,
        setBusy: (v) => setBusy(!!v)
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
