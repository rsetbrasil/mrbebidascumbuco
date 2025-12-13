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
    closeOnOverlayClick = true,
    noBodyLock = false
}) => {
    useEffect(() => {
        if (noBodyLock) return;
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            if (!noBodyLock) document.body.style.overflow = 'unset';
        };
    }, [isOpen, noBodyLock]);

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

    const modalStyle = (() => {
        const base = { ...sizeStyles[size] };
        if (size === 'full') {
            base.maxHeight = 'none';
            base.overflowY = 'visible';
        }
        return base;
    })();

    const bodyStyle = size === 'full'
        ? { maxHeight: 'none', overflowY: 'visible' }
        : { maxHeight: 'calc(90vh - 180px)', overflowY: 'auto' };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal" style={modalStyle}>
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

                <div className="modal-body" style={bodyStyle}>
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
