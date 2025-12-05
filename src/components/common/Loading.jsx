import React from 'react';

const Loading = ({ message = 'Carregando...', fullScreen = false }) => {
    const content = (
        <div className="loading-container">
            <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
                {message && (
                    <p style={{
                        marginTop: 'var(--spacing-lg)',
                        color: 'var(--color-text-secondary)'
                    }}>
                        {message}
                    </p>
                )}
            </div>
        </div>
    );

    if (fullScreen) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'var(--color-bg-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999
            }}>
                {content}
            </div>
        );
    }

    return content;
};

export default Loading;
