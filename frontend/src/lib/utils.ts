export function formatCurrency(amount: number, currency: string = 'INR'): string {
    const symbols: Record<string, string> = {
        INR: '₹',
        USD: '$',
        EUR: '€',
        GBP: '£',
    };

    return `${symbols[currency] || currency} ${amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return formatDate(dateString);
}

export function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
        initiated: 'bg-blue-100 text-blue-800',
        pending: 'bg-yellow-100 text-yellow-800',
        processing: 'bg-indigo-100 text-indigo-800',
        success: 'bg-green-100 text-green-800',
        failed: 'bg-red-100 text-red-800',
        ghost: 'bg-purple-100 text-purple-800',
    };

    return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getEscalationColor(status: string): string {
    const colors: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800',
        investigating: 'bg-orange-100 text-orange-800',
        resolved: 'bg-green-100 text-green-800',
        false_positive: 'bg-gray-100 text-gray-800',
    };

    return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getGhostScoreColor(score: number): string {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-green-600';
}

export function truncateText(text: string, maxLength: number = 50): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}
