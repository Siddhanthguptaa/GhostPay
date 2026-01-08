import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import logger from '../config/logger';

export const runMigrations = async (): Promise<void> => {
    try {
        logger.info('Starting database migrations...');

        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');

        await pool.query(schema);

        logger.info('✅ Database migrations completed successfully');
    } catch (error) {
        logger.error('❌ Database migration failed:', error);
        throw error;
    }
};

// Run migrations if this file is executed directly
if (require.main === module) {
    runMigrations()
        .then(() => {
            logger.info('Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Migration script failed:', error);
            process.exit(1);
        });
}
