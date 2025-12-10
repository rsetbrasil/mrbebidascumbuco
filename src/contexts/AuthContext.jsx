import React, { createContext, useContext, useState, useEffect } from 'react';
import { userService } from '../services/firestore';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sessionId, setSessionId] = useState(null);
    const [userUnsub, setUserUnsub] = useState(null);

    useEffect(() => {
        // Check for stored user session
        const storedUser = localStorage.getItem('pdv_user');
        const storedSession = localStorage.getItem('pdv_session_id');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        if (storedSession) {
            setSessionId(storedSession);
        }

        // Initialize default user if needed
        userService.initDefaultUser().catch(console.error);

        setLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            const userFound = await userService.getByUsername(username);

            if (!userFound) {
                throw new Error('Usuário não encontrado');
            }

            if (!userFound.active) {
                throw new Error('Usuário inativo');
            }

            // Simple password check (In production use bcrypt/hash)
            if (userFound.password !== password) {
                throw new Error('Senha incorreta');
            }

            // Remove password from state
            const { password: _, ...userWithoutPassword } = userFound;
            const sid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (`SID-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            try {
                await userService.update(userFound.id, { sessionId: sid, sessionUpdatedAt: new Date() });
            } catch (e) {
            }
            setUser(userWithoutPassword);
            setSessionId(sid);
            localStorage.setItem('pdv_user', JSON.stringify(userWithoutPassword));
            localStorage.setItem('pdv_session_id', sid);

            // Subscribe to user changes to enforce single session
            try {
                if (userUnsub) {
                    try { userUnsub(); } catch {}
                }
                const unsub = userService.subscribeById(userFound.id, (latest) => {
                    const remoteSid = latest?.sessionId || null;
                    const localSid = localStorage.getItem('pdv_session_id');
                    if (remoteSid && localSid && remoteSid !== localSid) {
                        // Remote session changed, logout this client
                        logout();
                        alert('Sua sessão foi iniciada em outro dispositivo. Este login foi encerrado.');
                    }
                });
                setUserUnsub(() => unsub);
            } catch {}
            return userWithoutPassword;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };

    const logout = () => {
        if (userUnsub) {
            try { userUnsub(); } catch {}
            setUserUnsub(null);
        }
        setUser(null);
        setSessionId(null);
        localStorage.removeItem('pdv_user');
        localStorage.removeItem('pdv_session_id');
    };

    const normalizeRole = (r) => {
        if (!r) return '';
        const map = {
            gerente: 'manager',
            manager: 'manager',
            caixa: 'cashier',
            cashier: 'cashier',
            vendedor: 'seller',
            seller: 'seller'
        };
        return map[r] || r;
    };

    const hasRole = (role) => {
        if (!user) return false;
        const userRole = normalizeRole(user.role);
        const target = normalizeRole(role);
        if (userRole === 'manager') return true; // Manager has all permissions
        return userRole === target;
    };

    const value = {
        user,
        loading,
        login,
        logout,
        hasRole,
        isAuthenticated: !!user,
        isManager: normalizeRole(user?.role) === 'manager',
        isCashier: normalizeRole(user?.role) === 'cashier'
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
