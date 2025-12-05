import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const Notification = ({ message, type = 'info', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000);

        return () => clearTimeout(timer);
    }, [onClose]);

    const icons = {
        success: <CheckCircle size={20} />,
        error: <XCircle size={20} />,
        warning: <AlertCircle size={20} />,
        info: <Info size={20} />
    };

    const colors = {
        success: 'var(--color-success)',
        error: 'var(--color-danger)',
        warning: 'var(--color-warning)',
        info: 'var(--color-primary)'
    };

    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 'var(--z-toast)',
            background: 'var(--color-bg-secondary)',
            border: `1px solid ${colors[type]}`,
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-md)',
            minWidth: '300px',
            maxWidth: '500px',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            animation: 'slideIn 0.3s ease-out'
        }}>
            <div style={{ color: colors[type], flexShrink: 0 }}>
                {icons[type]}
            </div>
            <div style={{ flex: 1, color: 'var(--color-text-primary)' }}>
                {message}
            </div>
            <button
                onClick={onClose}
                style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}
            >
                <X size={18} />
            </button>
        </div>
    );
};

export default Notification;
