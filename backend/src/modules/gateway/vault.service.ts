import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import { pool, isUsingInMemory, memoryStore } from '../../config/database';
import { PaymentToken, PaymentMethod } from '../shared/types';
import { generateToken } from '../shared/utils';
import logger from '../../config/logger';

const ENCRYPTION_KEY = process.env.TOKEN_VAULT_SECRET || 'default-secret-key-change-this';

export class VaultService {
    // Encrypt sensitive payment data
    private static encrypt(data: string): string {
        return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
    }

    // Decrypt payment data
    private static decrypt(encryptedData: string): string {
        const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
        return bytes.toString(CryptoJS.enc.Utf8);
    }

    // Tokenize payment data
    static async tokenize(
        transactionId: string,
        paymentData: any,
        paymentMethod: PaymentMethod,
        expiryMinutes: number = 15
    ): Promise<string> {
        try {
            const tokenValue = generateToken('tok');
            const encryptedPayload = this.encrypt(JSON.stringify(paymentData));
            const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

            if (isUsingInMemory()) {
                memoryStore.tokens.push({
                    id: uuidv4(),
                    transaction_id: transactionId,
                    token_value: tokenValue,
                    encrypted_payload: encryptedPayload,
                    payment_method: paymentMethod,
                    expires_at: expiresAt,
                    is_used: false,
                    created_at: new Date(),
                });
                logger.info(`Token created for transaction ${transactionId}`);
                return tokenValue;
            }

            const query = `
        INSERT INTO tokens (id, transaction_id, token_value, encrypted_payload, payment_method, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING token_value
      `;

            await pool.query(query, [
                uuidv4(),
                transactionId,
                tokenValue,
                encryptedPayload,
                paymentMethod,
                expiresAt,
            ]);

            logger.info(`Token created for transaction ${transactionId}`);
            return tokenValue;
        } catch (error) {
            logger.error('Token creation failed:', error);
            throw new Error('Failed to create payment token');
        }
    }

    // Detokenize and retrieve payment data
    static async detokenize(tokenValue: string): Promise<any | null> {
        try {
            if (isUsingInMemory()) {
                const token = memoryStore.tokens.find(t => t.token_value === tokenValue);
                if (!token) return null;
                if (new Date(token.expires_at) < new Date()) return null;
                if (token.is_used) return null;
                return JSON.parse(this.decrypt(token.encrypted_payload));
            }

            const query = `
        SELECT encrypted_payload, expires_at, is_used, payment_method
        FROM tokens
        WHERE token_value = $1
      `;

            const result = await pool.query(query, [tokenValue]);

            if (result.rows.length === 0) {
                logger.warn(`Token not found: ${tokenValue}`);
                return null;
            }

            const token = result.rows[0];

            // Check if token has expired
            if (new Date(token.expires_at) < new Date()) {
                logger.warn(`Token expired: ${tokenValue}`);
                return null;
            }

            // Check if token has been used
            if (token.is_used) {
                logger.warn(`Token already used: ${tokenValue}`);
                return null;
            }

            // Decrypt payload
            const decryptedData = this.decrypt(token.encrypted_payload);
            return JSON.parse(decryptedData);
        } catch (error) {
            logger.error('Token retrieval failed:', error);
            return null;
        }
    }

    // Mark token as used
    static async markTokenUsed(tokenValue: string): Promise<void> {
        try {
            if (isUsingInMemory()) {
                const token = memoryStore.tokens.find(t => t.token_value === tokenValue);
                if (token) token.is_used = true;
                return;
            }

            const query = `
        UPDATE tokens
        SET is_used = true
        WHERE token_value = $1
      `;

            await pool.query(query, [tokenValue]);
            logger.info(`Token marked as used: ${tokenValue}`);
        } catch (error) {
            logger.error('Failed to mark token as used:', error);
            throw error;
        }
    }

    // Clean up expired tokens
    static async cleanupExpiredTokens(): Promise<number> {
        try {
            if (isUsingInMemory()) {
                const now = new Date();
                const before = memoryStore.tokens.length;
                memoryStore.tokens = memoryStore.tokens.filter(
                    t => new Date(t.expires_at) >= now || t.is_used
                );
                return before - memoryStore.tokens.length;
            }

            const query = `
        DELETE FROM tokens
        WHERE expires_at < NOW() AND is_used = false
        RETURNING id
      `;

            const result = await pool.query(query);
            const deletedCount = result.rowCount || 0;

            logger.info(`Cleaned up ${deletedCount} expired tokens`);
            return deletedCount;
        } catch (error) {
            logger.error('Token cleanup failed:', error);
            return 0;
        }
    }

    // Validate card number (Luhn algorithm)
    static validateCardNumber(cardNumber: string): boolean {
        const digits = cardNumber.replace(/\D/g, '');
        if (digits.length < 13 || digits.length > 19) return false;

        let sum = 0;
        let isEven = false;

        for (let i = digits.length - 1; i >= 0; i--) {
            let digit = parseInt(digits[i]);

            if (isEven) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }

            sum += digit;
            isEven = !isEven;
        }

        return sum % 10 === 0;
    }

    // Mask card number for display
    static maskCardNumber(cardNumber: string): string {
        const cleaned = cardNumber.replace(/\D/g, '');
        if (cleaned.length < 4) return '****';
        return `**** **** **** ${cleaned.slice(-4)}`;
    }
}

export default VaultService;
