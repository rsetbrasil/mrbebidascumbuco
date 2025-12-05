import React, { useState, useEffect } from 'react';
import Input from './Input';

const CurrencyInput = ({ value, onChange, ...props }) => {
    const [displayValue, setDisplayValue] = useState('');

    useEffect(() => {
        if (value !== undefined && value !== null) {
            // Format initial value
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

        // Remove non-numeric characters
        const numericValue = inputValue.replace(/\D/g, '');

        if (numericValue === '') {
            onChange({ target: { value: '' } }); // Or 0 depending on requirement
            setDisplayValue('');
            return;
        }

        // Convert to number (divide by 100 for cents)
        const numberValue = parseFloat(numericValue) / 100;

        // Call parent onChange with the numeric value
        // Mimic event object structure
        onChange({ target: { name: props.name, value: numberValue } });
    };

    return (
        <Input
            {...props}
            type="text"
            value={displayValue}
            onChange={handleChange}
            placeholder="0,00"
        />
    );
};

export default CurrencyInput;
