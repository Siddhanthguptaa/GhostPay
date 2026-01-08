import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import argparse

np.random.seed(42)

def generate_synthetic_transactions(count: int = 10000) -> pd.DataFrame:
    """Generate synthetic payment transaction data with ghost transactions."""
    
    print(f"Generating {count} synthetic transactions...")
    
    # Transaction IDs
    transaction_ids = [f"TXN_{datetime.now().timestamp():.0f}_{i}" for i in range(count)]
    
    # Payment methods
    payment_methods = np.random.choice(['UPI', 'CARD', 'WALLET'], count, p=[0.5, 0.35, 0.15])
    
    # Amounts (log-normal distribution for realistic amounts)
    amounts = np.random.lognormal(mean=6, sigma=1.5, size=count)
    amounts = np.clip(amounts, 10, 50000).round(2)
    
    # Statuses
    status_probs = [0.75, 0.05, 0.03, 0.12, 0.05]  # success, pending, processing, failed, ghost
    statuses = np.random.choice(
        ['success', 'pending', 'processing', 'failed', 'ghost'],
        count,
        p=status_probs
    )
    
    # Timestamps
    base_time = datetime.now() - timedelta(days=30)
    initiated_times = [
        base_time + timedelta(minutes=np.random.randint(0, 43200)) 
        for _ in range(count)
    ]
    
    # Processing times (in seconds)
    processing_times = []
    for status in statuses:
        if status == 'success':
            processing_times.append(np.random.randint(1, 10))
        elif status == 'failed':
            processing_times.append(np.random.randint(5, 30))
        elif status == 'ghost':
            processing_times.append(np.random.randint(300, 3600))  # 5-60 minutes
        else:
            processing_times.append(np.random.randint(30, 600))
    
    # Webhook delivery
    webhook_delivered = []
    for status in statuses:
        if status == 'ghost':
            webhook_delivered.append(0)  # Ghost transactions have webhook failures
        elif status == 'success':
            webhook_delivered.append(1 if np.random.random() > 0.05 else 0)
        else:
            webhook_delivered.append(1 if np.random.random() > 0.3 else 0)
    
    # Ledger entries count
    ledger_counts = []
    for status in statuses:
        if status == 'ghost':
            ledger_counts.append(np.random.choice([1, 2]))  # Incomplete ledger
        elif status == 'success':
            ledger_counts.append(3)  # Gateway, Bank, Merchant
        else:
            ledger_counts.append(np.random.choice([1, 2, 3]))
    
    # Status transitions
    status_transition_count = []
    for status in statuses:
        if status == 'ghost':
            status_transition_count.append(np.random.randint(2, 5))
        elif status == 'success':
            status_transition_count.append(np.random.randint(3, 4))
        else:
            status_transition_count.append(np.random.randint(1, 3))
    
    # Hour of day
    hours = [t.hour for t in initiated_times]
    
    # Day of week
    days_of_week = [t.weekday() for t in initiated_times]
    
    # Is ghost (target variable)
    is_ghost = (statuses == 'ghost').astype(int)
    
    # Create DataFrame
    df = pd.DataFrame({
        'transaction_id': transaction_ids,
        'payment_method': payment_methods,
        'amount': amounts,
        'status': statuses,
        'initiated_at': initiated_times,
        'processing_time_seconds': processing_times,
        'webhook_delivered': webhook_delivered,
        'ledger_entry_count': ledger_counts,
        'status_transition_count': status_transition_count,
        'hour_of_day': hours,
        'day_of_week': days_of_week,
        'is_ghost': is_ghost
    })
    
    print(f"✅ Generated {count} transactions")
    print(f"   - Ghost transactions: {is_ghost.sum()} ({is_ghost.sum()/count*100:.2f}%)")
    print(f"   - Success transactions: {(statuses == 'success').sum()}")
    print(f"   - Failed transactions: {(statuses == 'failed').sum()}")
    
    return df

def main():
    parser = argparse.ArgumentParser(description='Generate synthetic transaction data')
    parser.add_argument('--count', type=int, default=10000, help='Number of transactions to generate')
    parser.add_argument('--output', type=str, default='data/transactions.csv', help='Output file path')
    
    args = parser.parse_args()
    
    # Generate data
    df = generate_synthetic_transactions(args.count)
    
    # Save to CSV
    import os
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    df.to_csv(args.output, index=False)
    
    print(f"\n✅ Data saved to: {args.output}")
    print(f"\nSample data:")
    print(df.head(10))

if __name__ == '__main__':
    main()
