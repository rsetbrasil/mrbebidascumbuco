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

    useEffect(() => {
        // Check for stored user session
        const storedUser = localStorage.getItem('pdv_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
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

            setUser(userWithoutPassword);
            localStorage.setItem('pdv_user', JSON.stringify(userWithoutPassword));
            return userWithoutPassword;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('pdv_user');
    };

    const hasRole = (role) => {
        if (!user) return false;
        if (user.role === 'manager') return true; // Manager has all permissions
        return user.role === role;
    };

    const value = {
        user,
        loading,
        login,
        logout,
        hasRole,
        isAuthenticated: !!user,
        isManager: user?.role === 'manager',
        isCashier: user?.role === 'cashier',
        isViewer: user?.role === 'viewer',
        canWrite: user?.role !== 'viewer'
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
