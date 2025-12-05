// Email validation
export const isValidEmail = (email) => {
    if (!email) return true; // Optional field
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

// Phone validation (Brazilian format)
export const isValidPhone = (phone) => {
    if (!phone) return true; // Optional field
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10 || cleaned.length === 11;
};

// CPF validation
export const isValidCPF = (cpf) => {
    if (!cpf) return true; // Optional field

    const cleaned = cpf.replace(/\D/g, '');

    if (cleaned.length !== 11) return false;
    if (/^(\d)\1+$/.test(cleaned)) return false; // All digits the same

    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) {
        sum += parseInt(cleaned.substring(i - 1, i)) * (11 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleaned.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) {
        sum += parseInt(cleaned.substring(i - 1, i)) * (12 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleaned.substring(10, 11))) return false;

    return true;
};

// CNPJ validation
export const isValidCNPJ = (cnpj) => {
    if (!cnpj) return true; // Optional field

    const cleaned = cnpj.replace(/\D/g, '');

    if (cleaned.length !== 14) return false;
    if (/^(\d)\1+$/.test(cleaned)) return false; // All digits the same

    let length = cleaned.length - 2;
    let numbers = cleaned.substring(0, length);
    const digits = cleaned.substring(length);
    let sum = 0;
    let pos = length - 7;

    for (let i = length; i >= 1; i--) {
        sum += numbers.charAt(length - i) * pos--;
        if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    length = length + 1;
    numbers = cleaned.substring(0, length);
    sum = 0;
    pos = length - 7;

    for (let i = length; i >= 1; i--) {
        sum += numbers.charAt(length - i) * pos--;
        if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;

    return true;
};

// Document validation (CPF or CNPJ)
export const isValidDocument = (document) => {
    if (!document) return true; // Optional field

    const cleaned = document.replace(/\D/g, '');

    if (cleaned.length === 11) {
        return isValidCPF(document);
    } else if (cleaned.length === 14) {
        return isValidCNPJ(document);
    }

    return false;
};

// Required field validation
export const isRequired = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return true;
    if (Array.isArray(value)) return value.length > 0;
    return !!value;
};

// Number validation
export const isValidNumber = (value, min = null, max = null) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(num)) return false;
    if (min !== null && num < min) return false;
    if (max !== null && num > max) return false;

    return true;
};

// Positive number validation
export const isPositive = (value) => {
    return isValidNumber(value, 0.01);
};

// Barcode validation
export const isValidBarcode = (barcode) => {
    if (!barcode) return false;
    const cleaned = barcode.replace(/\D/g, '');
    return cleaned.length >= 8 && cleaned.length <= 14;
};

// Form validation helper
export const validateForm = (data, rules) => {
    const errors = {};

    Object.keys(rules).forEach(field => {
        const value = data[field];
        const fieldRules = rules[field];

        if (fieldRules.required && !isRequired(value)) {
            errors[field] = 'Este campo é obrigatório';
            return;
        }

        if (value && fieldRules.email && !isValidEmail(value)) {
            errors[field] = 'E-mail inválido';
            return;
        }

        if (value && fieldRules.phone && !isValidPhone(value)) {
            errors[field] = 'Telefone inválido';
            return;
        }

        if (value && fieldRules.document && !isValidDocument(value)) {
            errors[field] = 'Documento inválido';
            return;
        }

        if (value && fieldRules.number) {
            if (!isValidNumber(value, fieldRules.min, fieldRules.max)) {
                errors[field] = 'Número inválido';
                return;
            }
        }

        if (value && fieldRules.positive && !isPositive(value)) {
            errors[field] = 'Deve ser um número positivo';
            return;
        }

        if (fieldRules.custom && !fieldRules.custom(value)) {
            errors[field] = fieldRules.customMessage || 'Valor inválido';
            return;
        }
    });

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};
