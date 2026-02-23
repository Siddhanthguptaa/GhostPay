import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

// Use DATABASE_URL (Docker-safe)
if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
}

// Create connection pool using connection string
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Error handler
pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    process.exit(-1);
});

// Test connection
export const testConnection = async (): Promise<boolean> => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        console.log('✅ Database connected successfully at:', result.rows[0].now);
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
};

// Query helper
export const query = async (text: string, params?: any[]) => {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Executed query', { text, duration, rows: result.rowCount });
        return result;
    } catch (error) {
        console.error('Query error:', { text, error });
        throw error;
    }
};

// Transaction helper
export const transaction = async (callback: (client: any) => Promise<any>) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export default pool;