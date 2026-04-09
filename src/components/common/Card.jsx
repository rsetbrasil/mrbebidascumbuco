import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const Card = ({
    children,
    title,
    subtitle,
    headerAction,
    icon: Icon,
    collapsible = false,
    defaultExpanded = true,
    className = '',
    ...props
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const toggleExpand = () => {
        if (collapsible) {
            setIsExpanded(!isExpanded);
        }
    };

    return (
        <div className={`card ${className}`} {...props}>
            {(title || subtitle || headerAction || Icon) && (
                <div 
                    className="card-header"
                    onClick={collapsible ? toggleExpand : undefined}
                    style={{ 
                        cursor: collapsible ? 'pointer' : 'default',
                        userSelect: collapsible ? 'none' : 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--spacing-md)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flex: 1 }}>
                        {Icon && <Icon size={24} style={{ color: 'var(--color-primary)' }} />}
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
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                        {headerAction && (
                            <div onClick={e => e.stopPropagation()}>
                                {headerAction}
                            </div>
                        )}
                        {collapsible && (
                            <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); toggleExpand(); }}
                                style={{ 
                                    background: 'transparent', 
                                    border: 'none', 
                                    color: 'var(--color-text-secondary)', 
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                        )}
                    </div>
                </div>
            )}
            <div style={{ 
                display: (!collapsible || isExpanded) ? 'block' : 'none',
                animation: 'fadeIn 0.2s ease-in-out'
            }}>
                {children}
            </div>
        </div>
    );
};

export default Card;
