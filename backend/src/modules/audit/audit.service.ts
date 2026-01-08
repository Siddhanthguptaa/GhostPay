import { pool } from '../../config/database';
import { CohereClient } from 'cohere-ai';
import { LedgerEntry, LedgerMismatch, AuditReport } from '../shared/types';
import logger from '../../config/logger';
import { v4 as uuidv4 } from 'uuid';

// Initialize Cohere AI
const USE_LLM = process.env.ENABLE_AI_AUDITOR === 'true' && process.env.COHERE_API_KEY;

let cohere: CohereClient | null = null;

if (USE_LLM && process.env.COHERE_API_KEY) {
  try {
    cohere = new CohereClient({
      token: process.env.COHERE_API_KEY,
    });
    console.log('✅ Cohere AI initialized successfully');
  } catch (error) {
    console.error('❌ Cohere initialization error:', error);
    console.warn('⚠️ Cohere initialization failed - using rule-based audits');
  }
} else {
  console.log('⚠️ Cohere not enabled');
}

export class AuditService {
    async ingestLedger(
        sourceType: string,
        entries: Array<{
            source_transaction_id: string;
            amount: number;
            currency?: string;
            status: string;
            entry_type: string;
            metadata?: any;
        }>
    ): Promise<void> {
        try {
            logger.info(`Ingesting ${entries.length} ledger entries from ${sourceType}`);

            for (const entry of entries) {
                const transactionQuery = await pool.query(
                    'SELECT id FROM transactions WHERE transaction_ref = $1',
                    [entry.source_transaction_id]
                );

                const transactionId = transactionQuery.rows[0]?.id || null;

                const query = `
          INSERT INTO ledger_entries (
            id, source_type, source_transaction_id, transaction_id,
            amount, currency, status, entry_type, metadata, recorded_at, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (source_type, source_transaction_id) DO UPDATE
          SET amount = EXCLUDED.amount, status = EXCLUDED.status
        `;

                await pool.query(query, [
                    uuidv4(),
                    sourceType,
                    entry.source_transaction_id,
                    transactionId,
                    entry.amount,
                    entry.currency || 'INR',
                    entry.status,
                    entry.entry_type,
                    JSON.stringify(entry.metadata || {}),
                    new Date(),
                    new Date(),
                ]);
            }

            logger.info(`Successfully ingested ledger from ${sourceType}`);
        } catch (error) {
            logger.error('Ledger ingestion failed:', error);
            throw error;
        }
    }

    async findMismatches(): Promise<LedgerMismatch[]> {
        try {
            const query = `
        WITH ledger_comparison AS (
          SELECT
            l1.transaction_id,
            l1.source_type as source_a_type,
            l1.amount as amount_a,
            l1.status as status_a,
            l1.entry_type as entry_type_a,
            l2.source_type as source_b_type,
            l2.amount as amount_b,
            l2.status as status_b,
            l2.entry_type as entry_type_b
          FROM ledger_entries l1
          JOIN ledger_entries l2 ON l1.transaction_id = l2.transaction_id
          WHERE l1.source_type < l2.source_type
            AND l1.transaction_id IS NOT NULL
            AND (l1.amount != l2.amount OR l1.status != l2.status)
        )
        SELECT * FROM ledger_comparison
      `;

            const result = await pool.query(query);
            const mismatches: LedgerMismatch[] = [];

            for (const row of result.rows) {
                const mismatchType =
                    row.amount_a !== row.amount_b
                        ? 'amount_mismatch'
                        : row.status_a !== row.status_b
                            ? 'status_mismatch'
                            : 'unknown';

                mismatches.push({
                    transaction_id: row.transaction_id,
                    source_a: {
                        source_type: row.source_a_type,
                        amount: parseFloat(row.amount_a),
                        status: row.status_a,
                        entry_type: row.entry_type_a,
                    } as any,
                    source_b: {
                        source_type: row.source_b_type,
                        amount: parseFloat(row.amount_b),
                        status: row.status_b,
                        entry_type: row.entry_type_b,
                    } as any,
                    difference: Math.abs(parseFloat(row.amount_a) - parseFloat(row.amount_b)),
                    mismatch_type: mismatchType,
                });
            }

            logger.info(`Found ${mismatches.length} ledger mismatches`);
            return mismatches;
        } catch (error) {
            logger.error('Mismatch detection failed:', error);
            throw error;
        }
    }

    async generateAuditReport(transactionId: string): Promise<AuditReport> {
        try {
            const transactionQuery = await pool.query(
                'SELECT * FROM transactions WHERE id = $1',
                [transactionId]
            );

            if (transactionQuery.rows.length === 0) {
                throw new Error(`Transaction not found: ${transactionId}`);
            }

            const transaction = transactionQuery.rows[0];

            const ledgerQuery = await pool.query(
                'SELECT * FROM ledger_entries WHERE transaction_id = $1 ORDER BY recorded_at',
                [transactionId]
            );

            const ledgerEntries = ledgerQuery.rows;

            const ghostQuery = await pool.query(
                'SELECT * FROM ghost_flags WHERE transaction_id = $1',
                [transactionId]
            );

            const ghostFlags = ghostQuery.rows;

            const findings: any = {
                transaction_ref: transaction.transaction_ref,
                amount: parseFloat(transaction.amount),
                currency: transaction.currency,
                status: transaction.status,
                ledger_entries: ledgerEntries.length,
                ghost_flags: ghostFlags.length,
                issues: [],
            };

            const gatewayEntry = ledgerEntries.find((e) => e.source_type === 'gateway');
            const bankEntry = ledgerEntries.find((e) => e.source_type === 'bank');
            const merchantEntry = ledgerEntries.find((e) => e.source_type === 'merchant');

            if (!bankEntry && gatewayEntry) {
                findings.issues.push('Missing bank confirmation despite gateway initiation');
            }

            if (bankEntry && !merchantEntry && transaction.status !== 'failed') {
                findings.issues.push('Bank processed but merchant not credited');
            }

            if (ledgerEntries.length > 1) {
                const amounts = ledgerEntries.map((e) => parseFloat(e.amount));
                if (new Set(amounts).size > 1) {
                    findings.issues.push('Amount discrepancy across ledger sources');
                }
            }

            let reportText: string;
            let confidenceScore: number = 0.5;

            if (USE_LLM && cohere) {
                const prompt = this.buildAuditPrompt(transaction, ledgerEntries, ghostFlags, findings);
                const aiResponse = await this.generateAIReport(prompt);
                reportText = aiResponse.report;
                confidenceScore = aiResponse.confidence;
            } else {
                reportText = this.generateRuleBasedReport(transaction, ledgerEntries, findings);
            }

            const insertQuery = `
        INSERT INTO audit_reports (
          id, transaction_id, report_type, findings, report_text,
          ai_model, confidence_score, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

            const reportType = findings.issues.length > 0 ? 'mismatch' : 'reconciliation';

            const result = await pool.query(insertQuery, [
                uuidv4(),
                transactionId,
                reportType,
                JSON.stringify(findings),
                reportText,
                USE_LLM && cohere ? 'cohere-command' : 'rule_based',
                confidenceScore,
                new Date(),
            ]);

            logger.info(`Audit report generated for transaction ${transaction.transaction_ref}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Audit report generation failed:', error);
            throw error;
        }
    }

    private buildAuditPrompt(
        transaction: any,
        ledgerEntries: any[],
        ghostFlags: any[],
        findings: any
    ): string {
        return `You are a financial auditor analyzing a payment transaction. Provide a clear, professional audit report.

**Transaction Details:**
- Transaction Reference: ${transaction.transaction_ref}
- Amount: ${transaction.currency} ${transaction.amount}
- Status: ${transaction.status}
- Payment Method: ${transaction.payment_method}
- Initiated: ${transaction.initiated_at}

**Ledger Entries (${ledgerEntries.length} total):**
${ledgerEntries
                .map(
                    (e) =>
                        `- ${e.source_type.toUpperCase()}: ${e.currency} ${e.amount} (${e.status}, ${e.entry_type})`
                )
                .join('\n')}

**Ghost Detection:**
${ghostFlags.length > 0 ? `- Score: ${ghostFlags[0].ghost_score}/100\n- Reasons: ${ghostFlags[0].reasons.join(', ')}` : '- No ghost flags detected'}

**Detected Issues:**
${findings.issues.length > 0 ? findings.issues.map((i: string) => `- ${i}`).join('\n') : '- No issues detected'}

Please provide a comprehensive audit report with these sections:

1. **Summary**: Brief overview of the transaction status
2. **Root Cause Analysis**: What likely went wrong and why (if applicable)
3. **Recommended Actions**: Specific steps to resolve this issue
4. **Severity Level**: Rate as Low/Medium/High with justification

Format your response in clear markdown with proper sections.`;
    }

    private async generateAIReport(
        prompt: string
    ): Promise<{ report: string; confidence: number }> {
        try {
            if (!cohere) {
                return { 
                    report: 'AI auditor disabled. Using rule-based analysis.', 
                    confidence: 0 
                };
            }

            console.log('🚀 Calling Cohere API...');
            
            const response = await cohere.generate({
                model: 'command',
                prompt: prompt,
                maxTokens: 500,
                temperature: 0.3,
            });

            const report = response.generations[0].text.trim();
            
            logger.info('✅ Cohere AI audit report generated successfully');
            console.log('✅ Cohere report generated, length:', report.length);
            
            return {
                report,
                confidence: 0.90,
            };
        } catch (error: any) {
            logger.error('Cohere AI report generation failed:', error);
            console.error('❌ Cohere error details:', error.message);
            
            return { 
                report: 'AI report generation unavailable. Using fallback analysis.', 
                confidence: 0.3 
            };
        }
    }

    private generateRuleBasedReport(
        transaction: any,
        ledgerEntries: any[],
        findings: any
    ): string {
        let report = `# Audit Report - ${transaction.transaction_ref}\n\n`;
        report += `**Amount**: ${transaction.currency} ${transaction.amount}\n`;
        report += `**Status**: ${transaction.status}\n`;
        report += `**Payment Method**: ${transaction.payment_method}\n\n`;

        report += `## Ledger Analysis\n`;
        report += `Found ${ledgerEntries.length} ledger entries from different sources.\n\n`;

        if (findings.issues.length > 0) {
            report += `## Issues Detected\n`;
            findings.issues.forEach((issue: string, idx: number) => {
                report += `${idx + 1}. ${issue}\n`;
            });
            report += `\n**Severity**: ${findings.issues.length > 2 ? 'High' : 'Medium'}\n`;
            report += `**Recommendation**: Immediate manual review and reconciliation required.\n`;
        } else {
            report += `## Status\n`;
            report += `No issues detected. Transaction appears to be properly reconciled across all sources.\n`;
            report += `\n**Severity**: Low\n`;
            report += `**Recommendation**: No action required.\n`;
        }

        return report;
    }

    async getAuditReports(limit: number = 50): Promise<AuditReport[]> {
        const query = `
      SELECT ar.*, t.transaction_ref, t.amount, t.currency
      FROM audit_reports ar
      JOIN transactions t ON ar.transaction_id = t.id
      ORDER BY ar.created_at DESC
      LIMIT $1
    `;

        const result = await pool.query(query, [limit]);

        return result.rows.map((row) => ({
            ...row,
            findings: typeof row.findings === 'string' ? JSON.parse(row.findings) : row.findings,
        }));
    }
}

export default AuditService;