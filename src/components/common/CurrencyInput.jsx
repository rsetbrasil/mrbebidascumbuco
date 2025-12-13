import React, { useState, useEffect } from 'react';
import Input from './Input';

const CurrencyInput = React.forwardRef(({ value, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState('');

    useEffect(() => {
        if (value !== undefined && value !== null) {
            const formatted = new Intl.NumberFormat('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(value);
            setDisplayValue(formatted);
        } else {
            setDisplayValue('');
        }
    }, [value]);

    const handleChange = (e) => {
        let inputValue = e.target.value;

        const numericValue = inputValue.replace(/\D/g, '');

        if (numericValue === '') {
            onChange({ target: { value: '' } });
            setDisplayValue('');
            return;
        }

        const numberValue = parseFloat(numericValue) / 100;

        onChange({ target: { name: props.name, value: numberValue } });
    };

    return (
        <Input
            ref={ref}
            {...props}
            type="text"
            value={displayValue}
            onChange={handleChange}
            placeholder="0,00"
        />
    );
});

export default CurrencyInput;
