import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

// Create connection pool using connection string (may be null if no DB configured)
export const pool: Pool = new Pool({
    connectionString: DATABASE_URL || 'postgresql://localhost:5432/payflow_db',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
});

// Error handler — do not crash the process if DB is unavailable
pool.on('error', (err) => {
    console.error('Unexpected database error:', err.message);
});

// ==================== In-Memory Fallback Store ====================
// Used when PostgreSQL is not available (demo / development mode)

interface InMemoryStore {
    merchants: any[];
    transactions: any[];
    tokens: any[];
    ledger_entries: any[];
    ghost_flags: any[];
    audit_reports: any[];
    webhook_events: any[];
}

export const memoryStore: InMemoryStore = {
    merchants: [
        {
            id: '00000000-0000-0000-0000-000000000001',
            name: 'Demo Merchant',
            email: 'demo@merchant.com',
            api_key: 'pk_test_demo_merchant_12345',
            webhook_url: 'http://localhost:3000/api/webhooks',
            webhook_secret: 'whsec_demo_secret_key',
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
        },
    ],
    transactions: [],
    tokens: [],
    ledger_entries: [],
    ghost_flags: [],
    audit_reports: [],
    webhook_events: [],
};

let useInMemory = false;

export const isUsingInMemory = () => useInMemory;

// Test connection
export const testConnection = async (): Promise<boolean> => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        console.log('✅ Database connected successfully at:', result.rows[0].now);
        useInMemory = false;
        return true;
    } catch (error: any) {
        console.warn('⚠️  Database connection failed:', error.message);
        console.warn('⚠️  Falling back to in-memory store (demo mode)');
        useInMemory = true;
        return true; // Return true so server still starts
    }
};

// Query helper
export const query = async (text: string, params?: any[]) => {
    if (useInMemory) {
        return { rows: [], rowCount: 0 };
    }
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.LOG_LEVEL === 'debug') {
            console.log('Executed query', { text: text.substring(0, 80), duration, rows: result.rowCount });
        }
        return result;
    } catch (error) {
        console.error('Query error:', { text: text.substring(0, 80), error });
        throw error;
    }
};

// Transaction helper
export const transaction = async (callback: (client: any) => Promise<any>) => {
    if (useInMemory) {
        return null;
    }
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