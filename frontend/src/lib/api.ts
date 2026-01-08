import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
    baseURL: `${API_URL}/api/v1`,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000,
});

// Request interceptor
apiClient.interceptors.request.use(
    (config) => {
        // Add auth token if available
        const token = localStorage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
apiClient.interceptors.response.use(
    (response) => response.data,
    (error) => {
        const errorMessage =
            error.response?.data?.error || error.message || 'An error occurred';
        return Promise.reject(new Error(errorMessage));
    }
);

// ==================== Payment APIs ====================

export const initiatePayment = async (paymentData: any) => {
    return apiClient.post('/payments/initiate', paymentData);
};

export const getPaymentStatus = async (transactionId: string) => {
    return apiClient.get(`/payments/${transactionId}`);
};

// ==================== Ghost Detection APIs ====================

export const detectGhostTransactions = async () => {
    return apiClient.post('/ghost/detect');
};

export const getGhostFlags = async (limit: number = 100) => {
    return apiClient.get(`/ghost/flags?limit=${limit}`);
};

export const resolveGhostFlag = async (id: string, notes: string) => {
    return apiClient.post(`/ghost/${id}/resolve`, { resolution_notes: notes });
};

export const markFalsePositive = async (id: string, notes: string) => {
    return apiClient.post(`/ghost/${id}/false-positive`, { notes });
};

// ==================== Audit APIs ====================

export const ingestLedger = async (sourceType: string, entries: any[]) => {
    return apiClient.post('/ledger/ingest', { source_type: sourceType, entries });
};

export const getLedgerMismatches = async () => {
    return apiClient.get('/ledger/mismatches');
};

export const generateAuditReport = async (transactionId: string) => {
    return apiClient.post(`/audit/generate/${transactionId}`);
};

export const getAuditReports = async (limit: number = 50) => {
    return apiClient.get(`/audit/reports?limit=${limit}`);
};

// ==================== Health Check ====================

export const healthCheck = async () => {
    return apiClient.get('/health');
};

export default apiClient;
