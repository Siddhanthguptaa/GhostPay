# PayFlow X GhostPay 💳🔍

A next-generation fintech simulation demonstrating payment gateway infrastructure, real-time anomaly detection, and AI-driven ledger auditing.

## 🎯 Project Overview

PayFlow X GhostPay simulates how digital payments (UPI, card, wallet) flow through multiple layers—gateway, bank, and merchant—and detects transactions that get lost or delayed (ghost transactions). It also audits mismatched ledgers using AI to generate human-readable reconciliation reports.

## 🏗️ Architecture

```
User → PayFlow Gateway API → Acquirer Mock → Bank Mock → Merchant Dashboard
         ↓
    Token Vault (AES-256)
         ↓
    Ghost Detector → Escalation Queue
         ↓
    Ledger Ingestor → AI Auditor → Human-readable Report
```

## 🛠️ Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Redis |
| Frontend | Next.js + React + Tailwind CSS |
| Visualization | Recharts |
| ML | Python (XGBoost, Scikit-learn, SHAP) |
| AI | OpenAI GPT / Local LLM |

## 📁 Project Structure

```
payflow-ghostpay/
├── backend/              # Node.js + TypeScript API
│   ├── src/
│   │   ├── modules/
│   │   │   ├── gateway/      # Payment gateway simulator
│   │   │   ├── ghost/        # Ghost detector
│   │   │   ├── audit/        # AI ledger auditor
│   │   │   └── shared/       # Common utilities
│   │   ├── config/
│   │   ├── database/
│   │   └── server.ts
│   └── package.json
├── frontend/             # Next.js dashboard
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   └── package.json
├── ml/                   # Python ML models
│   ├── ghost_classifier/
│   ├── data_generator/
│   └── requirements.txt
└── docker-compose.yml
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 7+
- Python 3.10+ (for ML components)
- Docker & Docker Compose (optional)

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd payflow-ghostpay
```

2. **Setup environment variables**
```bash
cp .env.example .env
# Edit .env with your database credentials and API keys
```

3. **Using Docker (Recommended)**
```bash
docker-compose up -d
```

4. **Manual Setup**

Backend:
```bash
cd backend
npm install
npm run migrate
npm run dev
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

ML Setup:
```bash
cd ml
pip install -r requirements.txt
python data_generator/synthetic_data.py
python ghost_classifier/train.py
```

## 🔑 Core Features

### 1. PayFlow Gateway Simulator
- Supports UPI, card, and wallet payments
- Token vault with AES-256 encryption
- Webhook callback system with retry logic
- Mock acquirer and bank simulators
- Configurable failure and latency injection

### 2. Ghost Detector
- Real-time transaction monitoring
- Rule-based and ML-based detection
- Ghost score calculation (0-100)
- SHAP explainability for transparency
- Automated escalation queue

### 3. AI Ledger Auditor
- Multi-source ledger ingestion
- Deterministic matching algorithm
- LLM-powered audit reports
- Plain-English explanations
- Root cause analysis

## 📊 Database Schema

- `transactions` - Payment transaction records
- `tokens` - Encrypted payment tokens
- `ledger_entries` - Multi-source ledger data
- `ghost_flags` - Anomaly detection flags
- `audit_reports` - AI-generated reports

## 🔒 Security

- **PCI-Compliant Simulation**: Never stores raw card details
- **AES-256 Encryption**: For token vault
- **HTTPS Only**: All API communications
- **API Key Rotation**: Recommended every 90 days
- **Input Validation**: Comprehensive sanitization

⚠️ **Note**: This is a simulation for educational purposes. Do not use in production without proper security audits.

## 📈 API Endpoints

### Payment Gateway
- `POST /api/v1/payments/initiate` - Initiate payment
- `GET /api/v1/payments/:id` - Get payment status
- `POST /api/v1/webhooks/callback` - Merchant webhook

### Ghost Detector
- `GET /api/v1/ghost/detect` - Run ghost detection
- `GET /api/v1/ghost/flags` - List ghost transactions
- `GET /api/v1/ghost/:id/score` - Get ghost score

### Ledger Auditor
- `POST /api/v1/ledger/ingest` - Ingest ledger data
- `POST /api/v1/audit/generate` - Generate audit report
- `GET /api/v1/audit/reports` - List audit reports

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Integration tests
npm run test:integration

# Load testing
npm run test:load
```

## 🎓 Learning Outcomes

This project demonstrates:
- ✅ Secure API design for fintech
- ✅ Event-driven architecture
- ✅ Real-time anomaly detection
- ✅ AI explainability (SHAP)
- ✅ Database design for financial systems
- ✅ Asynchronous webhook systems
- ✅ Full-stack development

## 📝 License

MIT License - Feel free to use for learning and portfolio purposes.

## 👨‍💻 Author

Built as a portfolio project to demonstrate payment infrastructure, ML, and AI integration skills.

---

**Disclaimer**: This is a simulation project for educational purposes only. Not intended for actual payment processing.
