import { randomBoolean, randomInRange, delay } from '../shared/utils';
import logger from '../../config/logger';

export interface AcquirerResponse {
    success: boolean;
    transaction_id: string;
    acquirer_ref: string;
    status: 'approved' | 'declined' | 'pending';
    message: string;
    processing_time_ms: number;
}

export class MockAcquirerService {
    // Configurable success rate (80% by default)
    private successRate: number;

    // Configurable latency range (100-2000ms)
    private minLatency: number;
    private maxLatency: number;

    constructor(
        successRate: number = 0.8,
        minLatency: number = 100,
        maxLatency: number = 2000
    ) {
        this.successRate = successRate;
        this.minLatency = minLatency;
        this.maxLatency = maxLatency;
    }

    // Process UPI payment
    async processUPI(
        transactionId: string,
        vpa: string,
        amount: number
    ): Promise<AcquirerResponse> {
        logger.info(`Processing UPI payment: ${transactionId} via ${vpa}`);

        const processingTime = randomInRange(this.minLatency, this.maxLatency);
        await delay(processingTime);

        const success = randomBoolean(this.successRate);

        return {
            success,
            transaction_id: transactionId,
            acquirer_ref: `ACQ_UPI_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: success ? 'approved' : 'declined',
            message: success
                ? 'UPI payment processed successfully'
                : 'UPI payment declined - Insufficient balance',
            processing_time_ms: processingTime,
        };
    }

    // Process Card payment
    async processCard(
        transactionId: string,
        cardToken: string,
        amount: number
    ): Promise<AcquirerResponse> {
        logger.info(`Processing Card payment: ${transactionId}`);

        const processingTime = randomInRange(this.minLatency, this.maxLatency);
        await delay(processingTime);

        // Randomly inject different failure scenarios
        const scenario = Math.random();
        let success: boolean;
        let message: string;
        let status: 'approved' | 'declined' | 'pending';

        if (scenario < this.successRate) {
            success = true;
            status = 'approved';
            message = 'Card payment approved';
        } else if (scenario < this.successRate + 0.05) {
            // 5% chance of pending status (ghost transaction trigger)
            success = false;
            status = 'pending';
            message = 'Card payment pending - Awaiting bank response';
        } else {
            success = false;
            status = 'declined';
            const reasons = [
                'Insufficient funds',
                'Card expired',
                'Invalid CVV',
                'Card blocked by issuer',
                'Daily limit exceeded',
            ];
            message = `Card declined - ${reasons[randomInRange(0, reasons.length - 1)]}`;
        }

        return {
            success,
            transaction_id: transactionId,
            acquirer_ref: `ACQ_CARD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status,
            message,
            processing_time_ms: processingTime,
        };
    }

    // Process Wallet payment
    async processWallet(
        transactionId: string,
        walletId: string,
        amount: number
    ): Promise<AcquirerResponse> {
        logger.info(`Processing Wallet payment: ${transactionId}`);

        const processingTime = randomInRange(this.minLatency, this.maxLatency);
        await delay(processingTime);

        const success = randomBoolean(this.successRate);

        return {
            success,
            transaction_id: transactionId,
            acquirer_ref: `ACQ_WALLET_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: success ? 'approved' : 'declined',
            message: success
                ? 'Wallet payment processed successfully'
                : 'Wallet payment declined - Insufficient wallet balance',
            processing_time_ms: processingTime,
        };
    }

    // Simulate callback delay (webhook trigger)
    async simulateCallback(transactionId: string): Promise<boolean> {
        // 10% chance of callback failure (creates ghost transactions)
        const callbackSuccess = randomBoolean(0.9);

        if (callbackSuccess) {
            const callbackDelay = randomInRange(500, 3000);
            await delay(callbackDelay);
            logger.info(`Callback sent for transaction ${transactionId} after ${callbackDelay}ms`);
            return true;
        } else {
            logger.warn(`Callback failed for transaction ${transactionId}`);
            return false;
        }
    }

    // Update success rate dynamically
    setSuccessRate(rate: number): void {
        this.successRate = Math.max(0, Math.min(1, rate));
        logger.info(`Acquirer success rate updated to ${this.successRate * 100}%`);
    }

    // Update latency range dynamically
    setLatencyRange(min: number, max: number): void {
        this.minLatency = min;
        this.maxLatency = max;
        logger.info(`Acquirer latency range updated to ${min}-${max}ms`);
    }
}

export default MockAcquirerService;
