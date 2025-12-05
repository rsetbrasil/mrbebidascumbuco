import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    size = 'md',
    closeOnOverlayClick = true
}) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) {
            onClose();
        }
    };

    const sizeStyles = {
        sm: { maxWidth: '400px' },
        md: { maxWidth: '600px' },
        lg: { maxWidth: '800px' },
        xl: { maxWidth: '1000px' },
        full: { maxWidth: '95vw' }
    };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal" style={sizeStyles[size]}>
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={<X size={20} />}
                        onClick={onClose}
                        aria-label="Fechar"
                    />
                </div>

                <div className="modal-body" style={{ maxHeight: 'calc(90vh - 180px)', overflowY: 'auto' }}>
                    {children}
                </div>

                {footer && (
                    <div className="modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;
