import { v4 as uuidv4 } from 'uuid';

// Generate unique transaction reference
export const generateTransactionRef = (): string => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TXN_${timestamp}_${random}`;
};

// Generate unique token
export const generateToken = (prefix: string = 'tok'): string => {
    return `${prefix}_${uuidv4().replace(/-/g, '')}`;
};

// Validate payment method
export const isValidPaymentMethod = (method: string): boolean => {
    return ['UPI', 'CARD', 'WALLET'].includes(method.toUpperCase());
};

// Validate currency
export const isValidCurrency = (currency: string): boolean => {
    return ['INR', 'USD', 'EUR', 'GBP'].includes(currency.toUpperCase());
};

// Calculate transaction fees (in percentage)
export const calculateFee = (amount: number, method: string): number => {
    const feeRates: Record<string, number> = {
        UPI: 0.005, // 0.5%
        CARD: 0.02, // 2%
        WALLET: 0.01, // 1%
    };
    return amount * (feeRates[method] || 0.015);
};

// Format amount with currency
export const formatAmount = (amount: number, currency: string = 'INR'): string => {
    const symbols: Record<string, string> = {
        INR: '₹',
        USD: '$',
        EUR: '€',
        GBP: '£',
    };
    return `${symbols[currency] || currency} ${amount.toFixed(2)}`;
};

// Validate email
export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Validate phone number (Indian format)
export const isValidPhone = (phone: string): boolean => {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/[\s-]/g, ''));
};

// Generate webhook signature
export const generateWebhookSignature = (
    payload: any,
    secret: string
): string => {
    const crypto = require('crypto');
    return crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
};

// Verify webhook signature
export const verifyWebhookSignature = (
    payload: any,
    signature: string,
    secret: string
): boolean => {
    const expectedSignature = generateWebhookSignature(payload, secret);
    return signature === expectedSignature;
};

// Sanitize sensitive data for logging
export const sanitizeForLogging = (data: any): any => {
    const sanitized = { ...data };
    const sensitiveFields = [
        'card_number',
        'cvv',
        'pin',
        'password',
        'api_key',
        'secret',
    ];

    Object.keys(sanitized).forEach((key) => {
        if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
            sanitized[key] = '***REDACTED***';
        }
    });

    return sanitized;
};

// Delay utility for testing
export const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

// Random number in range
export const randomInRange = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Random boolean with probability
export const randomBoolean = (probability: number = 0.5): boolean => {
    return Math.random() < probability;
};
