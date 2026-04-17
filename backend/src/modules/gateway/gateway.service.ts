import { v4 as uuidv4 } from 'uuid';
import { pool, isUsingInMemory, memoryStore } from '../../config/database';
import {
    Transaction,
    InitiatePaymentRequest,
    InitiatePaymentResponse,
    PaymentStatusResponse,
    TransactionStatus,
    PaymentMethod,
} from '../shared/types';
import { generateTransactionRef, isValidPaymentMethod } from '../shared/utils';
import VaultService from './vault.service';
import MockAcquirerService from './mock-acquirer';
import WebhookService from './webhook.service';
import logger from '../../config/logger';

export class GatewayService {
    private acquirer: MockAcquirerService;

    constructor() {
        this.acquirer = new MockAcquirerService(0.8, 100, 2000);
    }

    // Initiate a new payment transaction
    async initiatePayment(request: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
        try {
            // Validate payment method
            if (!isValidPaymentMethod(request.payment_method)) {
                throw new Error('Invalid payment method');
            }

            // Validate amount
            if (request.amount <= 0) {
                throw new Error('Amount must be greater than zero');
            }

            const transactionId = uuidv4();
            const transactionRef = generateTransactionRef();
            const currency = request.currency || 'INR';
            const now = new Date();

            if (isUsingInMemory()) {
                // In-memory transaction creation
                const transaction: any = {
                    id: transactionId,
                    merchant_id: request.merchant_id,
                    transaction_ref: transactionRef,
                    amount: request.amount,
                    currency,
                    payment_method: request.payment_method,
                    status: 'initiated',
                    customer_email: request.customer_email,
                    customer_phone: request.customer_phone,
                    description: request.description,
                    metadata: request.metadata || {},
                    initiated_at: now,
                    processed_at: null,
                    completed_at: null,
                    failed_at: null,
                    error_message: null,
                    created_at: now,
                    updated_at: now,
                };

                memoryStore.transactions.push(transaction);

                logger.info(`Payment initiated: ${transactionRef} - ${request.payment_method} - ${currency} ${request.amount}`);

                // Create ledger entry
                memoryStore.ledger_entries.push({
                    id: uuidv4(),
                    source_type: 'gateway',
                    source_transaction_id: transactionRef,
                    transaction_id: transactionId,
                    amount: request.amount,
                    currency,
                    status: 'initiated',
                    entry_type: 'debit',
                    metadata: {},
                    recorded_at: now,
                    created_at: now,
                });

                // Process payment asynchronously
                this.processPayment(transaction).catch((error) => {
                    logger.error(`Payment processing failed for ${transactionRef}:`, error);
                });

                return {
                    transaction_id: transactionId,
                    transaction_ref: transactionRef,
                    status: 'initiated' as TransactionStatus,
                    created_at: now,
                };
            }

            // Database mode
            const query = `
        INSERT INTO transactions (
          id, merchant_id, transaction_ref, amount, currency,
          payment_method, status, customer_email, customer_phone,
          description, metadata, initiated_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;

            const values = [
                transactionId,
                request.merchant_id,
                transactionRef,
                request.amount,
                currency,
                request.payment_method,
                'initiated',
                request.customer_email,
                request.customer_phone,
                request.description,
                JSON.stringify(request.metadata || {}),
                now,
                now,
                now,
            ];

            const result = await pool.query(query, values);
            const transaction = result.rows[0];

            logger.info(`Payment initiated: ${transactionRef} - ${request.payment_method} - ${currency} ${request.amount}`);

            // Create ledger entry for gateway
            await this.createLedgerEntry(
                transactionId,
                'gateway',
                transactionRef,
                request.amount,
                currency,
                'initiated',
                'debit'
            );

            // Process payment asynchronously
            this.processPayment(transaction).catch((error) => {
                logger.error(`Payment processing failed for ${transactionRef}:`, error);
            });

            return {
                transaction_id: transactionId,
                transaction_ref: transactionRef,
                status: 'initiated' as TransactionStatus,
                created_at: transaction.created_at,
            };
        } catch (error) {
            logger.error('Failed to initiate payment:', error);
            throw error;
        }
    }

    // Process payment through acquirer
    private async processPayment(transaction: any): Promise<void> {
        try {
            // Update status to pending
            await this.updateTransactionStatus(transaction.id, 'pending');

            let acquirerResponse;

            // Process based on payment method
            switch (transaction.payment_method) {
                case 'UPI':
                    acquirerResponse = await this.acquirer.processUPI(
                        transaction.id,
                        transaction.metadata?.vpa || 'user@upi',
                        typeof transaction.amount === 'string' ? parseFloat(transaction.amount) : transaction.amount
                    );
                    break;

                case 'CARD':
                    // Tokenize card data (simulate)
                    const token = await VaultService.tokenize(
                        transaction.id,
                        { card_last4: '1234', card_type: 'VISA' },
                        'CARD'
                    );
                    acquirerResponse = await this.acquirer.processCard(
                        transaction.id,
                        token,
                        typeof transaction.amount === 'string' ? parseFloat(transaction.amount) : transaction.amount
                    );
                    break;

                case 'WALLET':
                    acquirerResponse = await this.acquirer.processWallet(
                        transaction.id,
                        transaction.metadata?.wallet_id || 'wallet_123',
                        typeof transaction.amount === 'string' ? parseFloat(transaction.amount) : transaction.amount
                    );
                    break;

                default:
                    throw new Error(`Unsupported payment method: ${transaction.payment_method}`);
            }

            // Update transaction based on acquirer response
            if (acquirerResponse.success) {
                await this.updateTransactionStatus(transaction.id, 'processing');

                // Create bank ledger entry
                await this.createLedgerEntry(
                    transaction.id,
                    'bank',
                    acquirerResponse.acquirer_ref,
                    typeof transaction.amount === 'string' ? parseFloat(transaction.amount) : transaction.amount,
                    transaction.currency,
                    'approved',
                    'debit'
                );

                // Simulate final settlement
                setTimeout(async () => {
                    await this.completeTransaction(transaction.id, acquirerResponse.acquirer_ref);
                }, 1000);
            } else if (acquirerResponse.status === 'pending') {
                // Keep as pending (potential ghost transaction)
                logger.warn(`Transaction pending: ${transaction.transaction_ref}`);
            } else {
                await this.failTransaction(transaction.id, acquirerResponse.message);
            }
        } catch (error) {
            logger.error(`Payment processing error for ${transaction.transaction_ref}:`, error);
            await this.failTransaction(transaction.id, 'Payment processing failed');
        }
    }

    // Complete successful transaction
    private async completeTransaction(transactionId: string, acquirerRef: string): Promise<void> {
        try {
            const now = new Date();

            if (isUsingInMemory()) {
                const txn = memoryStore.transactions.find(t => t.id === transactionId);
                if (txn) {
                    txn.status = 'success';
                    txn.completed_at = now;
                    txn.metadata = { ...txn.metadata, acquirer_ref: acquirerRef };
                    txn.updated_at = now;

                    // Create merchant ledger entry
                    memoryStore.ledger_entries.push({
                        id: uuidv4(),
                        source_type: 'merchant',
                        source_transaction_id: txn.transaction_ref,
                        transaction_id: transactionId,
                        amount: txn.amount,
                        currency: txn.currency,
                        status: 'success',
                        entry_type: 'credit',
                        metadata: {},
                        recorded_at: now,
                        created_at: now,
                    });

                    logger.info(`Transaction completed successfully: ${txn.transaction_ref}`);
                }
                return;
            }

            const query = `
        UPDATE transactions
        SET status = 'success', completed_at = $2,
            metadata = jsonb_set(metadata, '{acquirer_ref}', $3)
        WHERE id = $1
        RETURNING *
      `;

            const result = await pool.query(query, [
                transactionId,
                now,
                JSON.stringify(acquirerRef),
            ]);

            const transaction = result.rows[0];

            // Create merchant ledger entry
            await this.createLedgerEntry(
                transactionId,
                'merchant',
                transaction.transaction_ref,
                transaction.amount,
                transaction.currency,
                'success',
                'credit'
            );

            // Get merchant webhook URL
            const merchantResult = await pool.query(
                'SELECT webhook_url FROM merchants WHERE id = $1',
                [transaction.merchant_id]
            );

            if (merchantResult.rows[0]?.webhook_url) {
                // Send webhook notification
                await WebhookService.scheduleWebhook(
                    transactionId,
                    transaction.merchant_id,
                    'payment.success',
                    {
                        transaction_id: transactionId,
                        transaction_ref: transaction.transaction_ref,
                        amount: transaction.amount,
                        currency: transaction.currency,
                        status: 'success',
                        completed_at: transaction.completed_at,
                    },
                    merchantResult.rows[0].webhook_url
                );
            }

            logger.info(`Transaction completed successfully: ${transaction.transaction_ref}`);
        } catch (error) {
            logger.error('Failed to complete transaction:', error);
        }
    }

    // Fail transaction
    private async failTransaction(transactionId: string, errorMessage: string): Promise<void> {
        const now = new Date();

        if (isUsingInMemory()) {
            const txn = memoryStore.transactions.find(t => t.id === transactionId);
            if (txn) {
                txn.status = 'failed';
                txn.failed_at = now;
                txn.error_message = errorMessage;
                txn.updated_at = now;
                logger.info(`Transaction failed: ${txn.transaction_ref} - ${errorMessage}`);
            }
            return;
        }

        const query = `
      UPDATE transactions
      SET status = 'failed', failed_at = $2, error_message = $3
      WHERE id = $1
      RETURNING *
    `;

        const result = await pool.query(query, [transactionId, now, errorMessage]);
        const transaction = result.rows[0];

        logger.info(`Transaction failed: ${transaction.transaction_ref} - ${errorMessage}`);
    }

    // Update transaction status
    private async updateTransactionStatus(
        transactionId: string,
        status: TransactionStatus
    ): Promise<void> {
        if (isUsingInMemory()) {
            const txn = memoryStore.transactions.find(t => t.id === transactionId);
            if (txn) {
                txn.status = status;
                txn.updated_at = new Date();
                if (status === 'processing') txn.processed_at = new Date();
            }
            return;
        }

        const statusColumn = status === 'processing' ? 'processed_at' : null;

        const query = statusColumn
            ? `UPDATE transactions SET status = $1, ${statusColumn} = $2 WHERE id = $3`
            : `UPDATE transactions SET status = $1 WHERE id = $2`;

        const params = statusColumn
            ? [status, new Date(), transactionId]
            : [status, transactionId];

        await pool.query(query, params);
    }

    // Create ledger entry
    private async createLedgerEntry(
        transactionId: string,
        sourceType: string,
        sourceTransactionId: string,
        amount: number,
        currency: string,
        status: string,
        entryType: string
    ): Promise<void> {
        const now = new Date();

        if (isUsingInMemory()) {
            const existing = memoryStore.ledger_entries.find(
                e => e.source_type === sourceType && e.source_transaction_id === sourceTransactionId
            );
            if (!existing) {
                memoryStore.ledger_entries.push({
                    id: uuidv4(),
                    source_type: sourceType,
                    source_transaction_id: sourceTransactionId,
                    transaction_id: transactionId,
                    amount,
                    currency,
                    status,
                    entry_type: entryType,
                    metadata: {},
                    recorded_at: now,
                    created_at: now,
                });
            }
            return;
        }

        const query = `
      INSERT INTO ledger_entries (
        id, source_type, source_transaction_id, transaction_id,
        amount, currency, status, entry_type, recorded_at, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (source_type, source_transaction_id) DO NOTHING
    `;

        await pool.query(query, [
            uuidv4(),
            sourceType,
            sourceTransactionId,
            transactionId,
            amount,
            currency,
            status,
            entryType,
            now,
            now,
        ]);
    }

    // Get payment status
    async getPaymentStatus(transactionId: string): Promise<PaymentStatusResponse | null> {
        if (isUsingInMemory()) {
            const txn = memoryStore.transactions.find(t => t.id === transactionId);
            if (!txn) return null;
            return {
                transaction_id: txn.id,
                transaction_ref: txn.transaction_ref,
                status: txn.status,
                amount: typeof txn.amount === 'string' ? parseFloat(txn.amount) : txn.amount,
                currency: txn.currency,
                payment_method: txn.payment_method,
                initiated_at: txn.initiated_at,
                completed_at: txn.completed_at,
                error_message: txn.error_message,
            };
        }

        const query = 'SELECT * FROM transactions WHERE id = $1';
        const result = await pool.query(query, [transactionId]);

        if (result.rows.length === 0) {
            return null;
        }

        const transaction = result.rows[0];

        return {
            transaction_id: transaction.id,
            transaction_ref: transaction.transaction_ref,
            status: transaction.status,
            amount: parseFloat(transaction.amount),
            currency: transaction.currency,
            payment_method: transaction.payment_method,
            initiated_at: transaction.initiated_at,
            completed_at: transaction.completed_at,
            error_message: transaction.error_message,
        };
    }
}

export default GatewayService;
