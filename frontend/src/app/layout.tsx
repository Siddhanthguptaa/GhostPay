import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'PayFlow X GhostPay - Merchant Dashboard',
    description: 'Payment Gateway Simulator with AI-Powered Anomaly Detection',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
