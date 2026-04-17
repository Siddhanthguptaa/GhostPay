-- PayFlow X GhostPay Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Merchants table
CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    webhook_url VARCHAR(500),
    webhook_secret VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    transaction_ref VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'INR',
    payment_method VARCHAR(50) NOT NULL, -- 'UPI', 'CARD', 'WALLET'
    status VARCHAR(50) NOT NULL DEFAULT 'initiated', -- 'initiated', 'pending', 'processing', 'success', 'failed', 'ghost'
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_status CHECK (status IN ('initiated', 'pending', 'processing', 'success', 'failed', 'ghost'))
);

-- Payment tokens table (encrypted storage)
CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    token_value VARCHAR(255) UNIQUE NOT NULL,
    encrypted_payload TEXT NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ledger entries table (multi-source reconciliation)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_type VARCHAR(50) NOT NULL, -- 'merchant', 'gateway', 'bank', 'acquirer'
    source_transaction_id VARCHAR(255) NOT NULL,
    transaction_id UUID REFERENCES transactions(id),
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(50) NOT NULL,
    entry_type VARCHAR(50) NOT NULL, -- 'debit', 'credit'
    metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_type, source_transaction_id)
);

-- Ghost flags table (anomaly detection)
CREATE TABLE IF NOT EXISTS ghost_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    ghost_score INTEGER NOT NULL CHECK (ghost_score >= 0 AND ghost_score <= 100),
    detection_method VARCHAR(50) NOT NULL, -- 'rule_based', 'ml_based'
    reasons JSONB NOT NULL DEFAULT '[]',
    escalation_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'investigating', 'resolved', 'false_positive'
    escalated_at TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit reports table (AI-generated)
CREATE TABLE IF NOT EXISTS audit_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES transactions(id),
    report_type VARCHAR(50) NOT NULL, -- 'mismatch', 'reconciliation', 'investigation'
    findings JSONB NOT NULL,
    report_text TEXT NOT NULL,
    ai_model VARCHAR(100),
    confidence_score DECIMAL(3, 2),
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhook events table (callback tracking)
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    webhook_url VARCHAR(500) NOT NULL,
    attempt_number INTEGER DEFAULT 1,
    status VARCHAR(50) NOT NULL, -- 'pending', 'sent', 'failed', 'delivered'
    http_status INTEGER,
    response_body TEXT,
    error_message TEXT,
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    next_retry_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_ref ON transactions(transaction_ref);

CREATE INDEX IF NOT EXISTS idx_tokens_transaction ON tokens(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_ledger_source ON ledger_entries(source_type, source_transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_recorded_at ON ledger_entries(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_ghost_flags_transaction ON ghost_flags(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ghost_flags_score ON ghost_flags(ghost_score DESC);
CREATE INDEX IF NOT EXISTS idx_ghost_flags_status ON ghost_flags(escalation_status);

CREATE INDEX IF NOT EXISTS idx_audit_reports_transaction ON audit_reports(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_created ON audit_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_transaction ON webhook_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_next_retry ON webhook_events(next_retry_at) WHERE status = 'pending';

-- Trigger to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_merchants_updated_at ON merchants;
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON merchants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ghost_flags_updated_at ON ghost_flags;
CREATE TRIGGER update_ghost_flags_updated_at BEFORE UPDATE ON ghost_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert demo merchant
INSERT INTO merchants (name, email, api_key, webhook_url, webhook_secret)
VALUES (
    'Demo Merchant',
    'demo@merchant.com',
    'pk_test_demo_merchant_12345',
    'http://localhost:3000/api/webhooks',
    'whsec_demo_secret_key'
) ON CONFLICT (email) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE transactions IS 'Core payment transactions table';
COMMENT ON TABLE ghost_flags IS 'Anomaly detection flags for ghost transactions';
COMMENT ON TABLE audit_reports IS 'AI-generated audit and reconciliation reports';
COMMENT ON TABLE ledger_entries IS 'Multi-source ledger for reconciliation';
