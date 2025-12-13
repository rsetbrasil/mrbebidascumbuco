import React from 'react';

const Button = React.forwardRef(({
    children,
    onClick,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    type = 'button',
    icon = null,
    className = '',
    fullWidth = false,
    ...props
}, ref) => {
    const baseClass = 'btn';
    const variantClass = `btn-${variant}`;
    const sizeClass = size !== 'md' ? `btn-${size}` : '';
    const iconClass = icon && !children ? 'btn-icon' : '';

    const classes = [baseClass, variantClass, sizeClass, iconClass, className]
        .filter(Boolean)
        .join(' ');

    // Render icon - handle both component and JSX element
    const renderIcon = () => {
        if (!icon) return null;
        // If icon is already a JSX element (has $$typeof), render it directly
        if (React.isValidElement(icon)) {
            return <span className="btn-icon-wrapper">{icon}</span>;
        }
        // Otherwise, treat it as a component and create element
        return <span className="btn-icon-wrapper">{React.createElement(icon, { size: 20 })}</span>;
    };

    return (
        <button
            ref={ref}
            type={type}
            className={classes}
            onClick={onClick}
            disabled={disabled || loading}
            {...props}
        >
            {renderIcon()}
            {children}
        </button>
    );
});

export default Button;
