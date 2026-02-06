import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { cashRegisterService, settingsService, salesService } from '../services/firestore';

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
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
    const autoClosedRef = useRef(new Set());

    // Sync theme with DOM and localStorage
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    // Load current cash register and settings on mount
    useEffect(() => {
        loadInitialData();
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

            // Reload cash register to update expected balance
            const updated = await cashRegisterService.getCurrent();
            setCurrentCashRegister(updated);

            showNotification('Movimento registrado com sucesso', 'success');
        } catch (error) {
            console.error('Error adding cash movement:', error);
            showNotification('Erro ao registrar movimento', 'error');
            throw error;
        }
    };

    const computeClosingBalance = async (register) => {
        try {
            const sales = await salesService.getByCashRegister(register.id);
            const validSales = (sales || []).filter(s => s && s.status !== 'cancelled');
            const totalSales = validSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
            const movements = await cashRegisterService.getMovements(register.id);
            const totalSupplies = (movements || [])
                .filter(m => m.type === 'supply')
                .reduce((acc, m) => acc + Number(m.amount || 0), 0);
            const totalBleeds = (movements || [])
                .filter(m => m.type === 'bleed')
                .reduce((acc, m) => acc + Number(m.amount || 0), 0);
            const totalChange = (movements || [])
                .filter(m => m.type === 'change')
                .reduce((acc, m) => acc + Number(m.amount || 0), 0);
            const opening = Number(register.openingBalance || 0);
            const finalBalance = opening + totalSales + totalSupplies - totalBleeds - totalChange;
            return finalBalance;
        } catch (error) {
            console.error('Error computing closing balance:', error);
            return Number(register.openingBalance || 0);
        }
    };

    useEffect(() => {
        const cutoffStr = String(settings?.cashRegisterAutoCloseTime || '22:00');
        const parseCutoff = () => {
            try {
                const [hh, mm] = cutoffStr.split(':');
                const h = Number(hh || 22);
                const m = Number(mm || 0);
                return { h: Number.isFinite(h) ? h : 22, m: Number.isFinite(m) ? m : 0 };
            } catch {
                return { h: 22, m: 0 };
            }
        };
        const { h, m } = parseCutoff();
        const check = async () => {
            if (!currentCashRegister || !currentCashRegister.id) return;
            if (autoClosedRef.current.has(currentCashRegister.id)) return;
            const now = new Date();
            const cutoff = new Date();
            cutoff.setHours(h, m, 0, 0);
            if (now >= cutoff) {
                try {
                    const closingBalance = await computeClosingBalance(currentCashRegister);
                    const difference = closingBalance - (Number(currentCashRegister.expectedBalance || 0));
                    await cashRegisterService.close(currentCashRegister.id, {
                        closingBalance,
                        closedBy: 'Sistema',
                        difference,
                        notes: `Fechamento automático às ${cutoffStr}`
                    });
                    autoClosedRef.current.add(currentCashRegister.id);
                    setCurrentCashRegister(null);
                    showNotification(`Caixa fechado automaticamente às ${cutoffStr}`, 'warning');
                } catch (error) {
                    console.error('Auto close cash register failed:', error);
                }
            }
        };
        const id = setInterval(check, 60_000);
        check();
        return () => clearInterval(id);
    }, [currentCashRegister, settings]);

    const value = {
        currentCashRegister,
        settings,
        theme,
        toggleTheme,
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
