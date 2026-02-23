import axios from 'axios';
import { pool } from '../../config/database';
import { queueOperations } from '../../config/redis';
import { WebhookEvent } from '../shared/types';
import { generateWebhookSignature, delay } from '../shared/utils';
import logger from '../../config/logger';
import { v4 as uuidv4 } from 'uuid';

const MAX_RETRY_ATTEMPTS = parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3');
const WEBHOOK_TIMEOUT = parseInt(process.env.WEBHOOK_TIMEOUT_MS || '5000');

export class WebhookService {
    // Schedule webhook delivery
    static async scheduleWebhook(
        transactionId: string,
        merchantId: string,
        eventType: string,
        payload: any,
        webhookUrl: string
    ): Promise<void> {
        try {
            const webhookEvent = {
                id: uuidv4(),
                transaction_id: transactionId,
                merchant_id: merchantId,
                event_type: eventType,
                payload,
                webhook_url: webhookUrl,
                attempt_number: 1,
                status: 'pending',
                scheduled_at: new Date(),
            };

            // Insert into database
            const query = `
        INSERT INTO webhook_events (
          id, transaction_id, merchant_id, event_type, payload,
          webhook_url, attempt_number, status, scheduled_at, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;

            await pool.query(query, [
                webhookEvent.id,
                webhookEvent.transaction_id,
                webhookEvent.merchant_id,
                webhookEvent.event_type,
                JSON.stringify(webhookEvent.payload),
                webhookEvent.webhook_url,
                webhookEvent.attempt_number,
                webhookEvent.status,
                webhookEvent.scheduled_at,
                new Date(),
            ]);

            // Add to Redis queue for processing
            await queueOperations.enqueue('webhook_queue', webhookEvent);

            logger.info(`Webhook scheduled for transaction ${transactionId}`);
        } catch (error) {
            logger.error('Failed to schedule webhook:', error);
            throw error;
        }
    }

    // Send webhook to merchant
    static async sendWebhook(webhookEvent: WebhookEvent): Promise<boolean> {
        try {
            // Get merchant's webhook secret
            const merchantQuery = await pool.query(
                'SELECT webhook_secret FROM merchants WHERE id = $1',
                [webhookEvent.merchant_id]
            );

            if (merchantQuery.rows.length === 0) {
                logger.error(`Merchant not found: ${webhookEvent.merchant_id}`);
                return false;
            }

            const webhookSecret = merchantQuery.rows[0].webhook_secret;
            const signature = generateWebhookSignature(webhookEvent.payload, webhookSecret);

            // Send HTTP POST request
            const response = await axios.post(webhookEvent.webhook_url, webhookEvent.payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-PayFlow-Signature': signature,
                    'X-PayFlow-Event': webhookEvent.event_type,
                },
                timeout: WEBHOOK_TIMEOUT,
            });

            // Update webhook event status
            await this.updateWebhookStatus(
                webhookEvent.id,
                'delivered',
                response.status,
                JSON.stringify(response.data)
            );

            logger.info(`Webhook delivered successfully: ${webhookEvent.id}`);
            return true;
        } catch (error: any) {
            logger.error(`Webhook delivery failed: ${webhookEvent.id}`, error.message);

            // Update status as failed
            await this.updateWebhookStatus(
                webhookEvent.id,
                'failed',
                error.response?.status,
                null,
                error.message
            );

            // Schedule retry if attempts remaining
            if (webhookEvent.attempt_number < MAX_RETRY_ATTEMPTS) {
                await this.scheduleRetry(webhookEvent);
            }

            return false;
        }
    }

    // Update webhook event status
    private static async updateWebhookStatus(
        webhookId: string,
        status: string,
        httpStatus?: number,
        responseBody?: string | null,
        errorMessage?: string
    ): Promise<void> {
        const query = `
      UPDATE webhook_events
      SET status = $2, http_status = $3, response_body = $4,
          error_message = $5, sent_at = $6, delivered_at = $7
      WHERE id = $1
    `;

        const sentAt = new Date();
        const deliveredAt = status === 'delivered' ? new Date() : null;

        await pool.query(query, [
            webhookId,
            status,
            httpStatus,
            responseBody,
            errorMessage,
            sentAt,
            deliveredAt,
        ]);
    }

    // Schedule webhook retry with exponential backoff
    private static async scheduleRetry(webhookEvent: WebhookEvent): Promise<void> {
        const retryDelay = Math.pow(2, webhookEvent.attempt_number) * 1000; // Exponential backoff
        const nextRetryAt = new Date(Date.now() + retryDelay);

        const updateQuery = `
      UPDATE webhook_events
      SET attempt_number = $2, next_retry_at = $3, status = 'pending'
      WHERE id = $1
    `;

        await pool.query(updateQuery, [
            webhookEvent.id,
            webhookEvent.attempt_number + 1,
            nextRetryAt,
        ]);

        // Re-queue with delay
        await delay(retryDelay);
        await queueOperations.enqueue('webhook_queue', {
            ...webhookEvent,
            attempt_number: webhookEvent.attempt_number + 1,
        });

        logger.info(
            `Webhook retry scheduled: ${webhookEvent.id} (attempt ${webhookEvent.attempt_number + 1})`
        );
    }

    // Process webhook queue (background worker)
    static async processWebhookQueue(): Promise<void> {
        logger.info('Starting webhook queue processor...');

        while (true) {
            try {
                const webhookEvent = await queueOperations.dequeue('webhook_queue', 5);

                if (webhookEvent) {
                    await this.sendWebhook(webhookEvent);
                }
            } catch (error) {
                logger.error('Webhook queue processing error:', error);
                await delay(1000); // Wait before retrying
            }
        }
    }

    // Get webhook events for a transaction
    static async getWebhookEvents(transactionId: string): Promise<WebhookEvent[]> {
        const query = `
      SELECT * FROM webhook_events
      WHERE transaction_id = $1
      ORDER BY created_at DESC
    `;

        const result = await pool.query(query, [transactionId]);
        return result.rows;
    }
}

export default WebhookService;
