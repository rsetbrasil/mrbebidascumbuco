import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Currency formatter
export const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'R$ 0,00';

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(numValue);
};

// Number formatter
export const formatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined) return '0';

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(numValue);
};

// Date formatter
export const formatDate = (date, formatStr = 'dd/MM/yyyy') => {
    if (!date) return '';

    try {
        // Handle Firestore Timestamp
        if (date.toDate && typeof date.toDate === 'function') {
            return format(date.toDate(), formatStr, { locale: ptBR });
        }

        // Handle Date object
        if (date instanceof Date) {
            return format(date, formatStr, { locale: ptBR });
        }

        // Handle string
        if (typeof date === 'string') {
            const parsed = parseISO(date);
            if (isValid(parsed)) {
                return format(parsed, formatStr, { locale: ptBR });
            }
        }

        return '';
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
};

// DateTime formatter
export const formatDateTime = (date) => {
    return formatDate(date, 'dd/MM/yyyy HH:mm');
};

// Time formatter
export const formatTime = (date) => {
    return formatDate(date, 'HH:mm:ss');
};

// Phone formatter
export const formatPhone = (phone) => {
    if (!phone) return '';

    const cleaned = phone.replace(/\D/g, '');

    if (cleaned.length === 11) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }

    return phone;
};

// Document formatter (CPF/CNPJ)
export const formatDocument = (document) => {
    if (!document) return '';

    const cleaned = document.replace(/\D/g, '');

    if (cleaned.length === 11) {
        // CPF
        return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
    } else if (cleaned.length === 14) {
        // CNPJ
        return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
    }

    return document;
};

// Barcode formatter
export const formatBarcode = (barcode) => {
    if (!barcode) return '';
    return barcode.replace(/\D/g, '');
};

// Parse currency string to number
export const parseCurrency = (value) => {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    // Remove dots (thousands separators) and replace comma with dot (decimal separator)
    const cleaned = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
};

// Truncate text
export const truncate = (text, maxLength = 50) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
};

// Generate sale number
export const generateSaleNumber = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');

    return `${year}${month}${day}${time}${random}`;
};

// Generate presale number
export const generatePresaleNumber = () => {
    return 'PRE' + generateSaleNumber();
};

// Format percentage
export const formatPercentage = (value, decimals = 2) => {
    if (value === null || value === undefined) return '0%';

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    const safeValue = Number.isFinite(numValue) ? numValue : 0;
    const asPercent = Math.abs(safeValue) <= 1 ? (safeValue * 100) : safeValue;

    return `${formatNumber(asPercent, decimals)}%`;
};

// Calculate percentage
export const calculatePercentage = (value, total) => {
    if (!total || total === 0) return 0;
    return (value / total) * 100;
};
