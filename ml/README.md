# PayFlow X GhostPay - ML Component

This directory contains Python machine learning components for ghost transaction detection.

## Components

### 1. Ghost Classifier (`ghost_classifier/`)
- XGBoost-based classification model
- SHAP explainability for transparency
- Feature engineering from transaction data

### 2. Data Generator (`data_generator/`)
- Synthetic transaction data generation
- Realistic ghost transaction injection
- Configurable failure rates and patterns

## Setup

```bash
cd ml
pip install -r requirements.txt
```

## Usage

### Generate Synthetic Data
```bash
python data_generator/synthetic_data.py --output data/transactions.csv --count 10000
```

### Train Model
```bash
python ghost_classifier/train.py --data data/transactions.csv --output models/ghost_model.pkl
```

### Make Predictions
```bash
python ghost_classifier/predict.py --model models/ghost_model.pkl --transaction <transaction_id>
```

## Features Used

- Transaction amount
- Time in pending state
- Webhook delivery status
- Ledger entry count
- Status transition patterns
- Payment method type
- Time of day / day of week

## Model Performance

Target Metrics:
- Precision: 0.90+
- Recall: 0.85+
- F1-Score: 0.87+
- ROC-AUC: 0.93+
