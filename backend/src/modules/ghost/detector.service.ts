import { pool } from '../../config/database';
import { GhostFlag, GhostDetectionResult, Transaction } from '../shared/types';
import logger from '../../config/logger';
import { v4 as uuidv4 } from 'uuid';

const GHOST_TIMEOUT_THRESHOLD_MS = parseInt(
    process.env.GHOST_TIMEOUT_THRESHOLD_MS || '5000'
); // 5 minutes

export class GhostDetectorService {
    // Run ghost detection on all transactions
    async detectGhostTransactions(): Promise<GhostFlag[]> {
        try {
            logger.info('Running ghost detection...');

            // Find potentially ghost transactions
            const query = `
        SELECT * FROM transactions
        WHERE status IN ('pending', 'processing', 'initiated')
          AND (
            (initiated_at < NOW() - INTERVAL '5 minutes' AND status = 'initiated')
            OR (processed_at < NOW() - INTERVAL '10 minutes' AND status = 'processing')
            OR (initiated_at < NOW() - INTERVAL '10 seconds' AND status = 'pending')
          )
          AND id NOT IN (SELECT transaction_id FROM ghost_flags WHERE escalation_status != 'false_positive')
      `;

            const result = await pool.query(query);
            const ghostFlags: GhostFlag[] = [];

            for (const transaction of result.rows) {
                const detectionResult = await this.analyzeTransaction(transaction);

                if (detectionResult.is_ghost) {
                    const ghostFlag = await this.flagAsGhost(
                        transaction.id,
                        detectionResult.ghost_score,
                        detectionResult.reasons
                    );
                    ghostFlags.push(ghostFlag);
                }
            }

            logger.info(`Ghost detection completed: ${ghostFlags.length} ghost transactions found`);
            return ghostFlags;
        } catch (error) {
            logger.error('Ghost detection failed:', error);
            throw error;
        }
    }

    // Analyze individual transaction for ghost indicators
    private async analyzeTransaction(transaction: Transaction): Promise<GhostDetectionResult> {
        const reasons: string[] = [];
        let score = 0;

        // Check 1: Timeout detection
        const timeInPending = Date.now() - new Date(transaction.initiated_at).getTime();
        if (timeInPending > GHOST_TIMEOUT_THRESHOLD_MS) {
            reasons.push(`Transaction stuck in ${transaction.status} for ${Math.floor(timeInPending / 60000)} minutes`);
            score += 30;
        }

        // Check 2: Webhook delivery failure
        const webhookQuery = await pool.query(
            'SELECT * FROM webhook_events WHERE transaction_id = $1 AND status = \'failed\' AND attempt_number >= 3',
            [transaction.id]
        );

        if (webhookQuery.rows.length > 0) {
            reasons.push('Webhook delivery failed after multiple attempts');
            score += 25;
        }

        // Check 3: Ledger mismatch
        const ledgerQuery = await pool.query(
            'SELECT source_type, amount, status FROM ledger_entries WHERE transaction_id = $1',
            [transaction.id]
        );

        const ledgerEntries = ledgerQuery.rows;
        const gatewayEntry = ledgerEntries.find((e) => e.source_type === 'gateway');
        const bankEntry = ledgerEntries.find((e) => e.source_type === 'bank');

        if (gatewayEntry && !bankEntry) {
            reasons.push('Gateway recorded transaction but no bank confirmation');
            score += 35;
        } else if (bankEntry && gatewayEntry && bankEntry.status !== gatewayEntry.status) {
            reasons.push('Status mismatch between gateway and bank');
            score += 20;
        }

        // Check 4: Missing merchant ledger entry
        const merchantEntry = ledgerEntries.find((e) => e.source_type === 'merchant');
        if (!merchantEntry && bankEntry?.status === 'approved') {
            reasons.push('Bank approved but merchant never credited');
            score += 40;
        }

        // Check 5: Status inconsistency
        if (transaction.status === 'processing' && !transaction.processed_at) {
            reasons.push('Status marked as processing but no processing timestamp');
            score += 15;
        }

        const isGhost = score >= 30;
        const recommendation = isGhost
            ? 'Immediate escalation required - High probability ghost transaction'
            : score >= 40
                ? 'Monitor closely - Potential ghost transaction'
                : 'Normal transaction flow';

        return {
            is_ghost: isGhost,
            ghost_score: Math.min(score, 100),
            reasons,
            recommendation,
        };
    }

    // Flag transaction as ghost
    private async flagAsGhost(
        transactionId: string,
        ghostScore: number,
        reasons: string[]
    ): Promise<GhostFlag> {
        const query = `
      INSERT INTO ghost_flags (
        id, transaction_id, ghost_score, detection_method,
        reasons, escalation_status, escalated_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

        const escalationStatus = ghostScore >= 80 ? 'investigating' : 'pending';

        const result = await pool.query(query, [
            uuidv4(),
            transactionId,
            ghostScore,
            'rule_based',
            JSON.stringify(reasons),
            escalationStatus,
            new Date(),
            new Date(),
            new Date(),
        ]);

        const ghostFlag = result.rows[0];

        // Update transaction status
        await pool.query(
            'UPDATE transactions SET status = $1 WHERE id = $2',
            ['ghost', transactionId]
        );

        logger.warn(`Transaction flagged as ghost: ${transactionId} (score: ${ghostScore})`);

        return {
            ...ghostFlag,
            reasons: JSON.parse(ghostFlag.reasons),
        };
    }

    // Get all ghost flags
    async getGhostFlags(limit: number = 100): Promise<GhostFlag[]> {
        const query = `
      SELECT gf.*, t.transaction_ref, t.amount, t.currency, t.payment_method
      FROM ghost_flags gf
      JOIN transactions t ON gf.transaction_id = t.id
      WHERE gf.escalation_status != 'false_positive'
      ORDER BY gf.ghost_score DESC, gf.created_at DESC
      LIMIT $1
    `;

        const result = await pool.query(query, [limit]);

        return result.rows.map((row) => ({
            ...row,
            reasons: typeof row.reasons === 'string' ? JSON.parse(row.reasons) : row.reasons,
        }));
    }

    // Resolve ghost flag
    async resolveGhostFlag(ghostFlagId: string, resolutionNotes: string): Promise<void> {
        const query = `
      UPDATE ghost_flags
      SET escalation_status = 'resolved',
          resolved_at = $2,
          resolution_notes = $3
      WHERE id = $1
    `;

        await pool.query(query, [ghostFlagId, new Date(), resolutionNotes]);
        logger.info(`Ghost flag resolved: ${ghostFlagId}`);
    }

    // Mark as false positive
    async markAsFalsePositive(ghostFlagId: string, notes: string): Promise<void> {
        const query = `
      UPDATE ghost_flags
      SET escalation_status = 'false_positive',
          resolved_at = $2,
          resolution_notes = $3
      WHERE id = $1
      RETURNING transaction_id
    `;

        const result = await pool.query(query, [ghostFlagId, new Date(), notes]);

        // Revert transaction status
        if (result.rows.length > 0) {
            await pool.query(
                'UPDATE transactions SET status = $1 WHERE id = $2',
                ['pending', result.rows[0].transaction_id]
            );
        }

        logger.info(`Ghost flag marked as false positive: ${ghostFlagId}`);
    }
}

export default GhostDetectorService;
