import 'dotenv/config';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { testConnection as testDatabaseConnection } from './config/database';
import { initRedis } from './config/redis';
import logger from './config/logger';
import apiRoutes from './routes/api';
import path from 'path';
import fs from 'fs';

const app: Application = express();
const PORT = process.env.PORT || 3001;

// ==================== Middleware ====================

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
    cors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
    })
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.http(`${req.method} ${req.path}`);
    next();
});

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// ==================== Routes ====================

app.use('/api/v1', apiRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
    res.json({
        service: 'PayFlow X GhostPay API',
        version: '1.0.0',
        description: 'Payment Gateway Simulator with AI Auditor',
        endpoints: {
            health: '/api/v1/health',
            payments: '/api/v1/payments',
            ghost: '/api/v1/ghost',
            audit: '/api/v1/audit',
            ledger: '/api/v1/ledger',
        },
    });
});

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
    });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
});

// ==================== Server Initialization ====================

const startServer = async () => {
    try {
        logger.info('🚀 Starting PayFlow X GhostPay server...');

        // Test database connection (graceful — won't crash if DB is unavailable)
        await testDatabaseConnection();

        // Initialize Redis (graceful — falls back to in-memory)
        await initRedis();

        // Start Express server
        app.listen(PORT, () => {
            logger.info(`✅ Server running on port ${PORT}`);
            logger.info(`📡 API available at http://localhost:${PORT}/api/v1`);
            logger.info(`🏥 Health check: http://localhost:${PORT}/api/v1/health`);
        });
    } catch (error) {
        logger.error('❌ Server startup failed:', error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit — just log
});

// Start the server
startServer();

export default app;
