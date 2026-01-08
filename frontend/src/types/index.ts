export type PaymentMethod = 'UPI' | 'CARD' | 'WALLET';
export type TransactionStatus = 'initiated' | 'pending' | 'processing' | 'success' | 'failed' | 'ghost';
export type EscalationStatus = 'pending' | 'investigating' | 'resolved' | 'false_positive';

export interface Transaction {
    id: string;
    transaction_ref: string;
    amount: number;
    currency: string;
    payment_method: PaymentMethod;
    status: TransactionStatus;
    customer_email?: string;
    customer_phone?: string;
    initiated_at: string;
    completed_at?: string;
    error_message?: string;
}

export interface GhostFlag {
    id: string;
    transaction_id: string;
    transaction_ref: string;
    amount: number;
    currency: string;
    payment_method: PaymentMethod;
    ghost_score: number;
    detection_method: string;
    reasons: string[];
    escalation_status: EscalationStatus;
    created_at: string;
}

export interface AuditReport {
    id: string;
    transaction_id?: string;
    transaction_ref?: string;
    report_type: string;
    findings: any;
    report_text: string;
    ai_model?: string;
    confidence_score?: number;
    created_at: string;
}

export interface DashboardStats {
    total_transactions: number;
    successful_transactions: number;
    failed_transactions: number;
    ghost_transactions: number;
    total_volume: number;
    success_rate: number;
}
