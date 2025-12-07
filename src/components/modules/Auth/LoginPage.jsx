import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, LogIn } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useApp } from '../../../contexts/AppContext';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Notification from '../../common/Notification';

const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState(null);

    const { login } = useAuth();
    const { settings } = useApp();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!username || !password) {
            setNotification({ type: 'warning', message: 'Preencha todos os campos' });
            return;
        }

        setLoading(true);
        try {
            await login(username, password);
            navigate('/');
        } catch (error) {
            setNotification({ type: 'error', message: error.message || 'Erro ao realizar login' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'var(--color-bg-primary)',
            padding: 'var(--spacing-md)'
        }}>
            {notification && (
                <Notification
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}

            <div style={{
                width: '100%',
                maxWidth: '400px',
                background: 'var(--color-bg-secondary)',
                padding: 'var(--spacing-2xl)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--color-border)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
                    <h1 style={{
                        fontSize: 'var(--font-size-2xl)',
                        fontWeight: 700,
                        background: 'var(--gradient-primary)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: 'var(--spacing-xs)'
                    }}>
                        {settings?.brandTitle || 'MR BEBIDAS'}
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Faça login para continuar</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                    <Input
                        label="Usuário"
                        placeholder="Digite seu usuário"
                        icon={User}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoFocus
                    />

                    <Input
                        label="Senha"
                        type="password"
                        placeholder="Digite sua senha"
                        icon={Lock}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        loading={loading}
                        icon={<LogIn size={20} />}
                        fullWidth
                    >
                        Entrar
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
