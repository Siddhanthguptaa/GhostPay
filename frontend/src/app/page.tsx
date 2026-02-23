'use client';

import { useEffect, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    CheckCircle,
    TrendingUp,
    DollarSign,
    Ghost as GhostIcon
} from 'lucide-react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { getGhostFlags, detectGhostTransactions } from '@/lib/api';
import { GhostFlag } from '@/types';
import { formatCurrency, formatRelativeTime, getStatusColor, getEscalationColor, getGhostScoreColor } from '@/lib/utils';

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#a855f7'];

export default function Dashboard() {
    const [ghostFlags, setGhostFlags] = useState<GhostFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [detecting, setDetecting] = useState(false);
    const [auditReports, setAuditReports] = useState<any[]>([]);

    useEffect(() => {
        loadGhostFlags();
        loadAuditReports();

        const interval = setInterval(() => {
            loadGhostFlags();
            loadAuditReports();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const loadGhostFlags = async () => {
        try {
            const response = await getGhostFlags(100);
            setGhostFlags(response.data || []);
        } catch (error) {
            console.error('Failed to load ghost flags:', error);
        } finally {
            setLoading(false);
        }
    };

    const runDetection = async () => {
        setDetecting(true);
        try {
            await detectGhostTransactions();
            await loadGhostFlags();
        } catch (error) {
            console.error('Ghost detection failed:', error);
        } finally {
            setDetecting(false);
        }
    };

    const loadAuditReports = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/audit/reports`);
            const data = await res.json();
            if (data.success) {
                setAuditReports(data.data || []);
            }
        } catch (error) {
            console.error('Failed to load audit reports:', error);
        }
    };

    // Calculate stats
    const stats = {
        total: ghostFlags.length,
        highRisk: ghostFlags.filter(f => f.ghost_score >= 80).length,
        investigating: ghostFlags.filter(f => f.escalation_status === 'investigating').length,
        resolved: ghostFlags.filter(f => f.escalation_status === 'resolved').length,
    };

    // Chart data
    const scoreDistribution = [
        { name: '0-25', count: ghostFlags.filter(f => f.ghost_score < 25).length },
        { name: '25-50', count: ghostFlags.filter(f => f.ghost_score >= 25 && f.ghost_score < 50).length },
        { name: '50-75', count: ghostFlags.filter(f => f.ghost_score >= 50 && f.ghost_score < 75).length },
        { name: '75-100', count: ghostFlags.filter(f => f.ghost_score >= 75).length },
    ];

    const statusData = [
        { name: 'Pending', value: ghostFlags.filter(f => f.escalation_status === 'pending').length },
        { name: 'Investigating', value: ghostFlags.filter(f => f.escalation_status === 'investigating').length },
        { name: 'Resolved', value: ghostFlags.filter(f => f.escalation_status === 'resolved').length },
        { name: 'False Positive', value: ghostFlags.filter(f => f.escalation_status === 'false_positive').length },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                PayFlow X GhostPay
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">Payment Gateway with AI-Powered Anomaly Detection</p>
                        </div>
                        <button
                            onClick={runDetection}
                            disabled={detecting}
                            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
                        >
                            <Activity className={detecting ? 'animate-spin' : ''} size={18} />
                            {detecting ? 'Detecting...' : 'Run Detection'}
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        title="Total Ghost Flags"
                        value={stats.total}
                        icon={<GhostIcon className="text-purple-600" size={24} />}
                        color="purple"
                    />
                    <StatCard
                        title="High Risk"
                        value={stats.highRisk}
                        icon={<AlertTriangle className="text-red-600" size={24} />}
                        color="red"
                    />
                    <StatCard
                        title="Investigating"
                        value={stats.investigating}
                        icon={<Activity className="text-orange-600" size={24} />}
                        color="orange"
                    />
                    <StatCard
                        title="Resolved"
                        value={stats.resolved}
                        icon={<CheckCircle className="text-green-600" size={24} />}
                        color="green"
                    />
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Score Distribution */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 card-shadow-hover">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800">Ghost Score Distribution</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={scoreDistribution}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="name" stroke="#6b7280" />
                                <YAxis stroke="#6b7280" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                                />
                                <Bar dataKey="count" fill="#a855f7" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Status Breakdown */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 card-shadow-hover">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800">Escalation Status</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, value }) => `${name}: ${value}`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Ghost Flags Table */}
                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-800">Recent Ghost Transactions</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Transaction
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Amount
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Ghost Score
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Time
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Reasons
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            Loading...
                                        </td>
                                    </tr>
                                ) : ghostFlags.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            No ghost transactions detected
                                        </td>
                                    </tr>
                                ) : (
                                    ghostFlags.slice(0, 20).map((flag) => (
                                        <tr key={flag.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{flag.transaction_ref}</div>
                                                <div className="text-xs text-gray-500">{flag.payment_method}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-semibold text-gray-900">
                                                    {formatCurrency(flag.amount, flag.currency)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className={`text-2xl font-bold ${getGhostScoreColor(flag.ghost_score)}`}>
                                                    {flag.ghost_score}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getEscalationColor(flag.escalation_status)}`}>
                                                    {flag.escalation_status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatRelativeTime(flag.created_at)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs text-gray-600 max-w-md">
                                                    {flag.reasons.slice(0, 2).map((reason, idx) => (
                                                        <div key={idx} className="mb-1">• {reason}</div>
                                                    ))}
                                                    {flag.reasons.length > 2 && (
                                                        <div className="text-gray-400">+{flag.reasons.length - 2} more</div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                {/* AI Audit Reports */}
                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden mt-10">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-800">
                            AI Audit Reports
                        </h2>
                    </div>

                    {auditReports.length === 0 ? (
                        <div className="px-6 py-12 text-center text-gray-500">
                            No audit reports generated
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {auditReports.map((report) => (
                                <div key={report.id} className="p-6 hover:bg-gray-50 transition">
                                    <div className="flex justify-between items-center mb-3">
                                        <div>
                                            <div className="text-sm font-semibold text-gray-900">
                                                {report.transaction_ref}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                Type: {report.report_type}
                                            </div>
                                        </div>

                                        <div className="text-sm font-medium text-indigo-600">
                                            Confidence: {(report.confidence_score * 100).toFixed(0)}%
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                                        {report.report_text}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

function StatCard({ title, value, icon, color }: any) {
    const colorClasses: Record<string, string> = {
        purple: 'from-purple-500 to-indigo-500',
        red: 'from-red-500 to-pink-500',
        orange: 'from-orange-500 to-amber-500',
        green: 'from-green-500 to-emerald-500',
    };

    return (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 card-shadow-hover">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600 font-medium">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
                </div>
                <div className={`p-3 rounded-lg bg-gradient-to-br ${colorClasses[color]}`}>
                    <div className="text-white">{icon}</div>
                </div>
            </div>
        </div>
    );
}
