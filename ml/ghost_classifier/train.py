import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, precision_recall_curve
import xgboost as xgb
import shap
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
import argparse
import os

def prepare_features(df: pd.DataFrame):
    """Prepare features for training."""
    
    # Encode payment method
    payment_method_map = {'UPI': 0, 'CARD': 1, 'WALLET': 2}
    df['payment_method_encoded'] = df['payment_method'].map(payment_method_map)
    
    # Feature engineering
    df['amount_log'] = np.log1p(df['amount'])
    df['processing_time_log'] = np.log1p(df['processing_time_seconds'])
    
    # Create time-based features
    df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
    df['is_peak_hour'] = df['hour_of_day'].isin([9, 10, 11, 12, 18, 19, 20, 21]).astype(int)
    df['is_late_night'] = df['hour_of_day'].isin([0, 1, 2, 3, 4, 5]).astype(int)
    
    # Define feature columns
    feature_columns = [
        'amount',
        'amount_log',
        'processing_time_seconds',
        'processing_time_log',
        'webhook_delivered',
        'ledger_entry_count',
        'status_transition_count',
        'payment_method_encoded',
        'hour_of_day',
        'day_of_week',
        'is_weekend',
        'is_peak_hour',
        'is_late_night'
    ]
    
    return df[feature_columns], df['is_ghost']

def train_model(X_train, y_train, X_test, y_test):
    """Train XGBoost classifier."""
    
    print("\n🎯 Training XGBoost model...")
    
    # XGBoost parameters
    params = {
        'max_depth': 6,
        'learning_rate': 0.1,
        'n_estimators': 200,
        'objective': 'binary:logistic',
        'eval_metric': 'auc',
        'scale_pos_weight': len(y_train[y_train == 0]) / len(y_train[y_train == 1]),  # Handle imbalance
        'subsample': 0.8,
        'colsample_bytree': 0.8,
        'random_state': 42
    }
    
    # Create and train model
    model = xgb.XGBClassifier(**params)
    
    model.fit(
        X_train, y_train,
        eval_set=[(X_train, y_train), (X_test, y_test)],
        verbose=50
    )
    
    return model

def evaluate_model(model, X_test, y_test, feature_names):
    """Evaluate model performance."""
    
    print("\n📊 Evaluating model...")
    
    # Predictions
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    # Classification report
    print("\n" + "="*50)
    print("CLASSIFICATION REPORT")
    print("="*50)
    print(classification_report(y_test, y_pred, target_names=['Normal', 'Ghost']))
    
    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    print("\nConfusion Matrix:")
    print(cm)
    
    # AUC Score
    auc = roc_auc_score(y_test, y_pred_proba)
    print(f"\n🎯 ROC-AUC Score: {auc:.4f}")
    
    # Feature importance
    print("\n📈 Top 10 Feature Importances:")
    feature_importance = pd.DataFrame({
        'feature': feature_names,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print(feature_importance.head(10).to_string(index=False))
    
    return {
        'auc': auc,
        'feature_importance': feature_importance
    }

def explain_model(model, X_train, X_test, feature_names, output_dir):
    """Generate SHAP explanations."""
    
    print("\n🔍 Generating SHAP explanations...")
    
    try:
        # Create SHAP explainer
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_test[:100])  # Use subset for speed
        
        # Summary plot
        plt.figure(figsize=(10, 6))
        shap.summary_plot(shap_values, X_test[:100], feature_names=feature_names, show=False)
        plt.tight_layout()
        plt.savefig(f'{output_dir}/shap_summary.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"✅ SHAP summary plot saved to: {output_dir}/shap_summary.png")
        
    except Exception as e:
        print(f"⚠️  SHAP explanation failed: {e}")

def main():
    parser = argparse.ArgumentParser(description='Train ghost transaction classifier')
    parser.add_argument('--data', type=str, default='data/transactions.csv', help='Training data CSV file')
    parser.add_argument('--output', type=str, default='models/ghost_model.pkl', help='Output model file')
    parser.add_argument('--test-size', type=float, default=0.2, help='Test set size')
    
    args = parser.parse_args()
    
    # Create output directory
    output_dir = os.path.dirname(args.output)
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs('models/plots', exist_ok=True)
    
    # Load data
    print(f"📂 Loading data from: {args.data}")
    df = pd.read_csv(args.data)
    print(f"✅ Loaded {len(df)} transactions")
    print(f"   - Ghost transactions: {df['is_ghost'].sum()}")
    print(f"   - Normal transactions: {len(df) - df['is_ghost'].sum()}")
    
    # Prepare features
    X, y = prepare_features(df)
    feature_names = X.columns.tolist()
    
    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=42, stratify=y
    )
    
    print(f"\n📊 Dataset split:")
    print(f"   - Training set: {len(X_train)} samples")
    print(f"   - Test set: {len(X_test)} samples")
    
    # Train model
    model = train_model(X_train, y_train, X_test, y_test)
    
    # Evaluate model
    metrics = evaluate_model(model, X_test, y_test, feature_names)
    
    # Generate SHAP explanations
    explain_model(model, X_train, X_test, feature_names, 'models/plots')
    
    # Save model
    model_data = {
        'model': model,
        'feature_names': feature_names,
        'metrics': metrics
    }
    
    joblib.dump(model_data, args.output)
    print(f"\n✅ Model saved to: {args.output}")
    print(f"\n🎉 Training complete!")
    print(f"\nModel Performance Summary:")
    print(f"   - ROC-AUC: {metrics['auc']:.4f}")
    print(f"   - Top feature: {metrics['feature_importance'].iloc[0]['feature']}")

if __name__ == '__main__':
    main()
