// Type definitions for PayFlow X GhostPay

export type PaymentMethod = 'UPI' | 'CARD' | 'WALLET';

export type TransactionStatus =
    | 'initiated'
    | 'pending'
    | 'processing'
    | 'success'
    | 'failed'
    | 'ghost';

export type SourceType = 'merchant' | 'gateway' | 'bank' | 'acquirer';

export type EntryType = 'debit' | 'credit';

export type DetectionMethod = 'rule_based' | 'ml_based';

export type EscalationStatus =
    | 'pending'
    | 'investigating'
    | 'resolved'
    | 'false_positive';

export type WebhookStatus = 'pending' | 'sent' | 'failed' | 'delivered';

export interface Transaction {
    id: string;
    merchant_id: string;
    transaction_ref: string;
    amount: number;
    currency: string;
    payment_method: PaymentMethod;
    status: TransactionStatus;
    customer_email?: string;
    customer_phone?: string;
    description?: string;
    metadata?: Record<string, any>;
    initiated_at: Date;
    processed_at?: Date;
    completed_at?: Date;
    failed_at?: Date;
    error_message?: string;
    created_at: Date;
    updated_at: Date;
}

export interface PaymentToken {
    id: string;
    transaction_id: string;
    token_value: string;
    encrypted_payload: string;
    payment_method: PaymentMethod;
    expires_at: Date;
    is_used: boolean;
    created_at: Date;
}

export interface LedgerEntry {
    id: string;
    source_type: SourceType;
    source_transaction_id: string;
    transaction_id?: string;
    amount: number;
    currency: string;
    status: string;
    entry_type: EntryType;
    metadata?: Record<string, any>;
    recorded_at: Date;
    created_at: Date;
}

export interface GhostFlag {
    id: string;
    transaction_id: string;
    ghost_score: number;
    detection_method: DetectionMethod;
    reasons: string[];
    escalation_status: EscalationStatus;
    escalated_at?: Date;
    resolved_at?: Date;
    resolution_notes?: string;
    created_at: Date;
    updated_at: Date;
}

export interface AuditReport {
    id: string;
    transaction_id?: string;
    report_type: string;
    findings: Record<string, any>;
    report_text: string;
    ai_model?: string;
    confidence_score?: number;
    reviewed_by?: string;
    reviewed_at?: Date;
    created_at: Date;
}

export interface WebhookEvent {
    id: string;
    transaction_id: string;
    merchant_id: string;
    event_type: string;
    payload: Record<string, any>;
    webhook_url: string;
    attempt_number: number;
    status: WebhookStatus;
    http_status?: number;
    response_body?: string;
    error_message?: string;
    scheduled_at: Date;
    sent_at?: Date;
    delivered_at?: Date;
    next_retry_at?: Date;
    created_at: Date;
}

export interface Merchant {
    id: string;
    name: string;
    email: string;
    api_key: string;
    webhook_url?: string;
    webhook_secret?: string;
    status: string;
    created_at: Date;
    updated_at: Date;
}

// API Request/Response types
export interface InitiatePaymentRequest {
    merchant_id: string;
    amount: number;
    currency?: string;
    payment_method: PaymentMethod;
    customer_email?: string;
    customer_phone?: string;
    description?: string;
    metadata?: Record<string, any>;
}

export interface InitiatePaymentResponse {
    transaction_id: string;
    transaction_ref: string;
    status: TransactionStatus;
    payment_url?: string;
    token?: string;
    created_at: Date;
}

export interface PaymentStatusResponse {
    transaction_id: string;
    transaction_ref: string;
    status: TransactionStatus;
    amount: number;
    currency: string;
    payment_method: PaymentMethod;
    initiated_at: Date;
    completed_at?: Date;
    error_message?: string;
}

export interface GhostDetectionResult {
    is_ghost: boolean;
    ghost_score: number;
    reasons: string[];
    recommendation: string;
}

export interface LedgerMismatch {
    transaction_id: string;
    source_a: LedgerEntry;
    source_b: LedgerEntry;
    difference: number;
    mismatch_type: string;
}
