# 🚀 PayFlow X GhostPay - Quick Start Guide

Get the complete payment gateway simulator running in under 5 minutes!

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 7+
- Python 3.10+ (for ML components)
- Docker & Docker Compose (recommended)

---

## Option 1: Docker (Recommended) 🐳

### 1. Clone and Setup
```bash
cd payflow-ghostpay
cp .env.example .env
```

### 2. Start All Services
```bash
docker-compose up -d
```

This will start:
- ✅ PostgreSQL database (port 5432)
- ✅ Redis cache/queue (port 6379)
- ✅ Backend API (port 3001)
- ✅ Frontend dashboard (port 3000)

### 3. Run Database Migrations
```bash
docker-compose exec backend npm run migrate
```

### 4. Access the Dashboard
Open your browser: **http://localhost:3000**

---

## Option 2: Manual Setup 🛠️

### 1. Setup Database
```bash
# Start PostgreSQL
createdb payflow_db

# Run schema
cd backend
npm install
npm run migrate
```

### 2. Setup Redis
```bash
# Start Redis server
redis-server
```

### 3. Start Backend
```bash
cd backend
npm install
npm run dev
# Backend runs on http://localhost:3001
```

### 4. Start Frontend
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

### 5. (Optional) Train ML Model
```bash
cd ml
pip install -r requirements.txt

# Generate synthetic data
python data_generator/synthetic_data.py --count 10000

# Train model
python ghost_classifier/train.py
```

---

## 🧪 Test the System

### 1. Initiate a Payment
```bash
curl -X POST http://localhost:3001/api/v1/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "get-from-database",
    "amount": 1000,
    "payment_method": "UPI",
    "customer_email": "customer@example.com"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "transaction_id": "uuid-here",
    "transaction_ref": "TXN_ABC123",
    "status": "initiated",
    "created_at": "2024-..."
  }
}
```

### 2. Run Ghost Detection
```bash
curl -X POST http://localhost:3001/api/v1/ghost/detect
```

### 3. View Results on Dashboard
Visit: http://localhost:3000
- See real-time ghost flags
- View charts and statistics
- Monitor transaction statuses

---

## 📋 API Endpoints

### Health Check
```bash
curl http://localhost:3001/api/v1/health
```

### Get Payment Status
```bash
curl http://localhost:3001/api/v1/payments/{transaction_id}
```

### List Ghost Flags
```bash
curl http://localhost:3001/api/v1/ghost/flags
```

### Generate Audit Report
```bash
curl -X POST http://localhost:3001/api/v1/audit/generate/{transaction_id}
```

### View Audit Reports
```bash
curl http://localhost:3001/api/v1/audit/reports
```

---

## 🔧 Configuration

Edit `.env` file to customize:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/payflow_db

# Redis
REDIS_URL=redis://localhost:6379

# OpenAI (for AI auditor)
OPENAI_API_KEY=sk-your-key-here
AI_MODEL=gpt-4-turbo-preview

# Ghost Detection
GHOST_TIMEOUT_THRESHOLD_MS=300000  # 5 minutes

# Webhook
WEBHOOK_RETRY_ATTEMPTS=3
```

---

## 🚨 Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
pg_isready

# Verify credentials in .env
psql -U payflow_user -d payflow_db
```

### Redis Connection Error
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG
```

### Port Already in Use
```bash
# Change ports in .env
PORT=3002  # Backend
# And in frontend: NEXT_PUBLIC_API_URL=http://localhost:3002
```

### ML Model Training Fails
```bash
# Make sure data directory exists
mkdir -p ml/data ml/models

# Reinstall dependencies
pip install -r ml/requirements.txt --force-reinstall
```

---

## 📊 Sample Data

### Get Demo Merchant ID
```sql
SELECT id FROM merchants WHERE email = 'demo@merchant.com';
```

### Create Test Transactions
Run the payment initiation API multiple times with different amounts and payment methods to populate the dashboard.

### Trigger Ghost Transactions
The system automatically creates ghost transactions through:
- Random webhook failures (10% chance)
- Pending status injection (5% chance)
- Wait 5+ minutes for timeout detection

---

## 🎯 What to Explore

1. **Payment Flow**
   - Initiate payment → Check status → View ledger entries
   
2. **Ghost Detection**
   - Wait for transactions to timeout
   - Run detection manually
   - View ghost scores and reasons
   
3. **AI Auditor**
   - Ingest external ledger data
   - Generate audit reports
   - Review AI explanations

4. **Dashboard**
   - Real-time statistics
   - Interactive charts
   - Transaction monitoring

---

## 📚 Next Steps

- Deploy to production (Railway/Vercel)
- Add authentication (JWT)
- Implement WebSocket for real-time updates
- Add more payment methods
- Enhance ML model with more features
- Add integration tests

---

## 🆘 Need Help?

Check the main [README.md](file:///Users/amit/.gemini/antigravity/playground/shimmering-eagle/README.md) for detailed documentation.

Review the [walkthrough.md](file:///Users/amit/.gemini/antigravity/brain/c1ab80a5-1d1f-4590-8218-b84fa080d7e2/walkthrough.md) for implementation details.

---

**Happy coding! 🎉**
