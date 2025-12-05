import React from 'react';

const Input = React.forwardRef(({
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    error,
    disabled = false,
    required = false,
    icon = null,
    className = '',
    textarea = false,
    helperText,
    ...props
}, ref) => {
    const inputId = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const inputType = textarea ? 'textarea' : type;

    return (
        <div className={`input-group ${className}`}>
            {label && (
                <label htmlFor={inputId} className="input-label">
                    {label}
                    {required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
                </label>
            )}

            <div style={{ position: 'relative' }}>
                {icon && (
                    <span style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--color-text-muted)',
                        pointerEvents: 'none'
                    }}>
                        {React.isValidElement(icon) ? icon : React.createElement(icon, { size: 18 })}
                    </span>
                )}

                {inputType === 'textarea' ? (
                    <textarea
                        ref={ref}
                        id={inputId}
                        className="input"
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        disabled={disabled}
                        required={required}
                        style={icon ? { paddingLeft: '40px' } : {}}
                        {...props}
                    />
                ) : (
                    <input
                        ref={ref}
                        id={inputId}
                        type={type}
                        className="input"
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        disabled={disabled}
                        required={required}
                        style={icon ? { paddingLeft: '40px' } : {}}
                        {...props}
                    />
                )}
            </div>

            {helperText && !error && (
                <span style={{
                    display: 'block',
                    marginTop: '4px',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-muted)'
                }}>
                    {helperText}
                </span>
            )}

            {error && (
                <span style={{
                    display: 'block',
                    marginTop: '4px',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-danger)'
                }}>
                    {error}
                </span>
            )}
        </div>
    );
});

export default Input;
