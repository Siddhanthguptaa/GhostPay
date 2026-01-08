import express, { Request, Response, NextFunction } from 'express';
import GatewayService from '../modules/gateway/gateway.service';
import GhostDetectorService from '../modules/ghost/detector.service';
import AuditService from '../modules/audit/audit.service';
import { InitiatePaymentRequest } from '../modules/shared/types';
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

// ==================== Health Check ====================

router.get('/health', (req: Request, res: Response) => {
    res.json({
        success: true,
        service: 'PayFlow X GhostPay',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});

export default router;
