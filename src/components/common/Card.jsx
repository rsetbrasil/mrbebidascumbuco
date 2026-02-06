import React from 'react';

const Card = ({
    children,
    title,
    subtitle,
    headerAction,
    className = '',
    ...props
}) => {
    return (
        <div className={`card ${className}`} {...props}>
            {(title || subtitle || headerAction) && (
                <div className="card-header">
                    <div>
                        {title && <h3 className="card-title">{title}</h3>}
                        {subtitle && (
                            <p style={{
                                margin: 0,
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-text-secondary)',
                                marginTop: '4px'
                            }}>
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {headerAction && <div>{headerAction}</div>}
                </div>
            )}
            {children}
        </div>
    );
};

export default Card;
