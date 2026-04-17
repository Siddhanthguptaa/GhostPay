import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import GatewayService from '../modules/gateway/gateway.service';
import GhostDetectorService from '../modules/ghost/detector.service';
import AuditService from '../modules/audit/audit.service';
import { InitiatePaymentRequest } from '../modules/shared/types';
import { isUsingInMemory, memoryStore } from '../config/database';
import { generateTransactionRef } from '../modules/shared/utils';
import logger from '../config/logger';

const router = express.Router();

const gatewayService = new GatewayService();
const ghostDetector = new GhostDetectorService();
const auditService = new AuditService();

// ==================== Payment Gateway Routes ====================

// Initiate payment
router.post('/payments/initiate', async (req: Request, res: Response) => {
    try {
        const paymentRequest: InitiatePaymentRequest = req.body;

        // Validate required fields
        if (!paymentRequest.merchant_id || !paymentRequest.amount || !paymentRequest.payment_method) {
            return res.status(400).json({
                error: 'Missing required fields: merchant_id, amount, payment_method',
            });
        }

        const response = await gatewayService.initiatePayment(paymentRequest);

        res.status(201).json({
            success: true,
            data: response,
        });
    } catch (error: any) {
        logger.error('Payment initiation error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Payment initiation failed',
        });
    }
});

// Get payment status
router.get('/payments/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const status = await gatewayService.getPaymentStatus(id);

        if (!status) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found',
            });
        }

        res.json({
            success: true,
            data: status,
        });
    } catch (error: any) {
        logger.error('Get payment status error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch payment status',
        });
    }
});

// ==================== Ghost Detection Routes ====================

// Run ghost detection
router.post('/ghost/detect', async (req: Request, res: Response) => {
    try {
        const ghostFlags = await ghostDetector.detectGhostTransactions();

        res.json({
            success: true,
            data: {
                count: ghostFlags.length,
                flags: ghostFlags,
            },
        });
    } catch (error: any) {
        logger.error('Ghost detection error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Ghost detection failed',
        });
    }
});

// Get ghost flags
router.get('/ghost/flags', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const flags = await ghostDetector.getGhostFlags(limit);

        res.json({
            success: true,
            data: flags,
        });
    } catch (error: any) {
        logger.error('Get ghost flags error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch ghost flags',
        });
    }
});

// Resolve ghost flag
router.post('/ghost/:id/resolve', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { resolution_notes } = req.body;

        await ghostDetector.resolveGhostFlag(id, resolution_notes);

        res.json({
            success: true,
            message: 'Ghost flag resolved successfully',
        });
    } catch (error: any) {
        logger.error('Resolve ghost flag error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to resolve ghost flag',
        });
    }
});

// Mark as false positive
router.post('/ghost/:id/false-positive', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        await ghostDetector.markAsFalsePositive(id, notes);

        res.json({
            success: true,
            message: 'Marked as false positive',
        });
    } catch (error: any) {
        logger.error('Mark false positive error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to mark as false positive',
        });
    }
});

// ==================== AI Auditor Routes ====================

// Ingest ledger data
router.post('/ledger/ingest', async (req: Request, res: Response) => {
    try {
        const { source_type, entries } = req.body;

        if (!source_type || !entries || !Array.isArray(entries)) {
            return res.status(400).json({
                error: 'Missing required fields: source_type, entries (array)',
            });
        }

        await auditService.ingestLedger(source_type, entries);

        res.json({
            success: true,
            message: `Ingested ${entries.length} ledger entries from ${source_type}`,
        });
    } catch (error: any) {
        logger.error('Ledger ingestion error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Ledger ingestion failed',
        });
    }
});

// Find ledger mismatches
router.get('/ledger/mismatches', async (req: Request, res: Response) => {
    try {
        const mismatches = await auditService.findMismatches();

        res.json({
            success: true,
            data: {
                count: mismatches.length,
                mismatches,
            },
        });
    } catch (error: any) {
        logger.error('Find mismatches error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to find mismatches',
        });
    }
});

// Generate audit report
router.post('/audit/generate/:transactionId', async (req: Request, res: Response) => {
    try {
        const { transactionId } = req.params;
        const report = await auditService.generateAuditReport(transactionId);

        res.json({
            success: true,
            data: report,
        });
    } catch (error: any) {
        logger.error('Generate audit report error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate audit report',
        });
    }
});

// Get audit reports
router.get('/audit/reports', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const reports = await auditService.getAuditReports(limit);

        res.json({
            success: true,
            data: reports,
        });
    } catch (error: any) {
        logger.error('Get audit reports error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch audit reports',
        });
    }
});

// ==================== Demo Data Route ====================

router.post('/demo/seed', async (req: Request, res: Response) => {
    try {
        const merchantId = isUsingInMemory()
            ? memoryStore.merchants[0]?.id || '00000000-0000-0000-0000-000000000001'
            : '00000000-0000-0000-0000-000000000001';

        // Create some real transactions via the gateway
        const methods = ['UPI', 'CARD', 'WALLET'] as const;
        for (let i = 0; i < 4; i++) {
            await gatewayService.initiatePayment({
                merchant_id: merchantId,
                amount: [2500, 7500, 12000, 35000][i],
                currency: 'INR',
                payment_method: methods[i % 3],
                customer_email: `customer${i + 1}@example.com`,
                description: `Live payment #${i + 1}`,
            });
        }

        // Directly inject ghost-flagged transactions (in-memory mode only)
        if (isUsingInMemory()) {
            const ghostTxns = [
                { amount: 15000, method: 'UPI', score: 95, status: 'investigating', reasons: ['Transaction stuck in pending for 12 minutes', 'Gateway recorded transaction but no bank confirmation', 'Bank approved but merchant never credited'] },
                { amount: 42000, method: 'CARD', score: 85, status: 'investigating', reasons: ['Transaction stuck in processing for 8 minutes', 'Webhook delivery failed after multiple attempts', 'Status mismatch between gateway and bank'] },
                { amount: 8500, method: 'WALLET', score: 70, status: 'pending', reasons: ['Transaction stuck in pending for 6 minutes', 'Gateway recorded transaction but no bank confirmation'] },
                { amount: 3200, method: 'UPI', score: 65, status: 'pending', reasons: ['Transaction stuck in initiated for 15 minutes', 'Status marked as processing but no processing timestamp'] },
                { amount: 28000, method: 'CARD', score: 55, status: 'pending', reasons: ['Gateway recorded transaction but no bank confirmation'] },
                { amount: 5000, method: 'UPI', score: 45, status: 'pending', reasons: ['Transaction stuck in pending for 5 minutes'] },
                { amount: 7600, method: 'WALLET', score: 35, status: 'pending', reasons: ['Status mismatch between gateway and bank'] },
                { amount: 19500, method: 'CARD', score: 90, status: 'investigating', reasons: ['Transaction stuck in pending for 22 minutes', 'Bank approved but merchant never credited', 'Webhook delivery failed after multiple attempts'] },
                { amount: 1200, method: 'UPI', score: 30, status: 'resolved', reasons: ['Transaction stuck in initiated for 7 minutes'] },
                { amount: 62000, method: 'CARD', score: 80, status: 'pending', reasons: ['Transaction stuck in processing for 10 minutes', 'Gateway recorded transaction but no bank confirmation', 'Amount discrepancy across ledger sources'] },
            ];

            for (const ghost of ghostTxns) {
                const txnId = uuidv4();
                const ref = generateTransactionRef();
                const pastTime = new Date(Date.now() - Math.floor(Math.random() * 3600000 + 300000));

                // Create stuck transaction
                memoryStore.transactions.push({
                    id: txnId,
                    merchant_id: merchantId,
                    transaction_ref: ref,
                    amount: ghost.amount,
                    currency: 'INR',
                    payment_method: ghost.method,
                    status: 'ghost',
                    customer_email: `ghost${Math.floor(Math.random() * 100)}@example.com`,
                    description: `Ghost transaction - ${ghost.method}`,
                    metadata: {},
                    initiated_at: pastTime,
                    processed_at: ghost.score > 60 ? new Date(pastTime.getTime() + 5000) : null,
                    completed_at: null,
                    failed_at: null,
                    error_message: null,
                    created_at: pastTime,
                    updated_at: new Date(),
                });

                // Create gateway ledger entry
                memoryStore.ledger_entries.push({
                    id: uuidv4(),
                    source_type: 'gateway',
                    source_transaction_id: ref,
                    transaction_id: txnId,
                    amount: ghost.amount,
                    currency: 'INR',
                    status: 'initiated',
                    entry_type: 'debit',
                    metadata: {},
                    recorded_at: pastTime,
                    created_at: pastTime,
                });

                // Sometimes add bank entry with mismatch
                if (ghost.score > 60) {
                    memoryStore.ledger_entries.push({
                        id: uuidv4(),
                        source_type: 'bank',
                        source_transaction_id: `ACQ_${ghost.method}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                        transaction_id: txnId,
                        amount: ghost.score > 80 ? ghost.amount : ghost.amount + Math.floor(Math.random() * 50),
                        currency: 'INR',
                        status: 'approved',
                        entry_type: 'debit',
                        metadata: {},
                        recorded_at: new Date(pastTime.getTime() + 3000),
                        created_at: new Date(pastTime.getTime() + 3000),
                    });
                }

                // Create ghost flag
                const flagTime = new Date(pastTime.getTime() + 300000);
                memoryStore.ghost_flags.push({
                    id: uuidv4(),
                    transaction_id: txnId,
                    transaction_ref: ref,
                    amount: ghost.amount,
                    currency: 'INR',
                    payment_method: ghost.method,
                    ghost_score: ghost.score,
                    detection_method: 'rule_based',
                    reasons: ghost.reasons,
                    escalation_status: ghost.status,
                    escalated_at: flagTime,
                    resolved_at: ghost.status === 'resolved' ? new Date() : null,
                    resolution_notes: ghost.status === 'resolved' ? 'Manually verified - delayed settlement confirmed' : null,
                    created_at: flagTime,
                    updated_at: new Date(),
                });
            }

            // Create some audit reports
            const ghostWithHighScore = memoryStore.ghost_flags.filter(g => g.ghost_score >= 70);
            for (const flag of ghostWithHighScore.slice(0, 3)) {
                const txn = memoryStore.transactions.find(t => t.id === flag.transaction_id);
                if (!txn) continue;

                memoryStore.audit_reports.push({
                    id: uuidv4(),
                    transaction_id: txn.id,
                    transaction_ref: txn.transaction_ref,
                    amount: txn.amount,
                    currency: txn.currency,
                    report_type: 'mismatch',
                    findings: {
                        transaction_ref: txn.transaction_ref,
                        amount: txn.amount,
                        currency: txn.currency,
                        status: txn.status,
                        issues: flag.reasons,
                    },
                    report_text: `# Audit Report - ${txn.transaction_ref}\n\n**Amount**: ${txn.currency} ${txn.amount}\n**Status**: ${txn.status}\n**Payment Method**: ${txn.payment_method}\n\n## Issues Detected\n${flag.reasons.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}\n\n**Severity**: ${flag.ghost_score >= 80 ? 'High' : 'Medium'}\n**Recommendation**: Immediate manual review and reconciliation required.`,
                    ai_model: 'rule_based',
                    confidence_score: 0.85,
                    reviewed_by: null,
                    reviewed_at: null,
                    created_at: new Date(Date.now() - Math.floor(Math.random() * 600000)),
                });
            }
        }

        res.json({
            success: true,
            message: `Demo data seeded with ${isUsingInMemory() ? memoryStore.ghost_flags.length + ' ghost flags' : 'live transactions'}!`,
        });
    } catch (error: any) {
        logger.error('Demo seed error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to seed demo data',
        });
    }
});

// ==================== Health Check ====================

router.get('/health', (req: Request, res: Response) => {
    res.json({
        success: true,
        service: 'PayFlow X GhostPay',
        version: '1.0.0',
        mode: isUsingInMemory() ? 'in-memory (demo)' : 'database',
        timestamp: new Date().toISOString(),
    });
});

export default router;
