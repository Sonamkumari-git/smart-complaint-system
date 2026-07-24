# AI Smart Complaint Management System (SCMS)

**Developed by: Sonam Kumari**

A production-grade, enterprise-level complaint management platform designed for colleges, hostels, companies, hospitals, apartments, and other organizations.

The system combines a full REST backend, a role-based web UI, and a **real multi-task deep learning model** built on DistilBERT that classifies complaints by category, priority, department, and sentiment, and detects near-duplicate complaints using sentence embeddings.

**🚀 Live Deployment:** [https://scms-backend-wll3.onrender.com](https://scms-backend-wll3.onrender.com)

---

## 1. Architecture

```
    Browser
       |
       | HTTP / REST
       v
+------------------+       +---------------------+       +------------+
|  HTML/CSS/JS UI  | <---> |  Node.js + Express  | <---> |  MySQL     |
+------------------+       +---------------------+       +------------+
                                    |
                                    | HTTP
                                    v
                       +--------------------------+
                       |  Python FastAPI service  |
                       |  Multi-task DistilBERT   |
                       |  (Hugging Face Hosted)   |
                       +--------------------------+
```

### Technology Stack

#### **Frontend**
- HTML5 + CSS3 + Vanilla JavaScript
- Chart.js for analytics dashboards
- No framework dependencies (lightweight, fast)
- Responsive UI with role-based views

#### **Backend**
- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.18+
- **Authentication:** JWT (jsonwebtoken 9.0+) with bcrypt password hashing
- **Middleware:** Helmet (security), CORS (cross-origin), Express Rate Limit, Morgan (logging)
- **Validation:** Express Validator 7.0+
- **File Upload:** Multer 1.4+ for image handling
- **Database Driver:** mysql2 3.6+ (high-performance MySQL connector)
- **HTTP Client:** Axios 1.6+ (for AI microservice communication)
- **Environment:** dotenv 16.3+ for configuration management

#### **Database**
- **DBMS:** MySQL 8+
- **Schema:** Fully normalized relational database
- **Features:** Foreign keys, indexes, audit logging, cascade operations
- **Hosted:** Cloud-based MySQL instance (managed database)

#### **AI/ML Service**
- **Language:** Python 3.9+
- **Framework:** FastAPI 0.109+ (async, high-performance REST API)
- **Server:** Uvicorn (ASGI server)
- **Deep Learning:** PyTorch (latest stable)
- **Transformer Models:** Hugging Face Transformers library
  - **Main Model:** `distilbert-base-uncased` (multi-task classification backbone)
  - **Duplicate Detection:** `sentence-transformers/all-MiniLM-L6-v2` (semantic embedding)
- **Data Processing:** scikit-learn, NumPy, Pandas
- **Request Validation:** Pydantic 2.5+
- **Model Deployment Strategy:** 
  - Models hosted on Hugging Face Model Hub (prevents Render RAM exhaustion)
  - Auto-downloaded on first inference
  - Cached locally for subsequent requests
  - Fallback keyword-based predictions if models unavailable

---

## 2. The AI Model

A single DistilBERT encoder feeds three classification heads:

```
             Complaint Text
                   |
               Tokenizer
                   |
              DistilBERT (shared)
                   |
       +-------------+-------------+
       |             |             |
       v             v             v
   Category      Priority     Sentiment
     Head          Head          Head
       |             |             |
       v             v             v
    Category     Priority     Sentiment
       |
       v
   Department (mapped from category)
```

**Model Architecture:**
- **Backbone:** `distilbert-base-uncased` (66M parameters, 6 layers)
- **Multi-task Loss:** `L = CE(category) + CE(priority) + 0.5 * CE(sentiment)`
- **Output Classes:**
  - Category: 15+ complaint types
  - Priority: 4 levels (Low, Medium, High, Critical)
  - Sentiment: 3 classes (Positive, Neutral, Negative)
  - Department: Derived deterministically from category for organizational mapping

**Key Features:**
- Department is rule-based (intentional) — ensures output matches real org departments
- Safety priority escalation: `Security/Safety` or `Harassment` → minimum `High` priority
- Near-duplicate detection uses **MiniLM sentence embeddings** (fast, accurate)
- Falls back to TF-IDF + cosine similarity if embedding model unavailable

**Deployment:**
- Model checkpoint hosted on Hugging Face Model Hub
- Automatic download and caching on container startup
- No local storage bloat on Render
- Graceful fallback to keyword-based predictions if download fails

See `ai-service/README_MODEL.md` for detailed model training and inference documentation.

---

## 3. Repository Layout

```
smart-complaint-system/
├── README.md
├── database/
│   └── schema.sql                 # MySQL schema + seed data
├── backend/                       # Node.js + Express REST API
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   ├── config/db.js
│   ├── middleware/
│   │   ├── auth.js                # JWT validation
│   │   └── validation.js          # Input sanitization
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── complaintController.js
│   │   ├── adminController.js
│   │   └── analyticsController.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── complaintRoutes.js
│   │   └── adminRoutes.js
│   ├── utils/
│   │   ├── aiClient.js            # FastAPI AI service client
│   │   ├── seed.js                # Database seeding with demo users
│   │   └── logger.js              # Structured logging
│   └── uploads/                   # Multer image upload directory
├── frontend/                      # HTML + CSS + Vanilla JavaScript
│   ├── index.html                 # Single-page application entry
│   ├── css/
│   │   └── style.css              # Responsive design + dark mode
│   └── js/
│       ├── api.js                 # REST API client wrapper
│       ├── auth.js                # Login/register/JWT management
│       ├── router.js              # Client-side routing
│       ├── pages.js               # User complaint pages
│       ├── admin.js               # Admin dashboard + management
│       ├── analytics.js           # Chart.js dashboard rendering
│       └── app.js                 # Application bootstrap
└── ai-service/                    # Python FastAPI + PyTorch
    ├── requirements.txt           # All Python dependencies
    ├── README_MODEL.md            # Model training guide
    ├── app/
    │   ├── main.py                # FastAPI endpoints (/predict, /duplicate-check)
    │   ├── model.py               # MultiTaskComplaintModel class
    │   ├── inference.py           # Model loading + prediction logic
    │   ├── labels.py              # Canonical labels (categories, priorities)
    │   └── huggingface_utils.py   # Hugging Face model download/cache
    ├── training/
    │   └── train.py               # Multi-task DistilBERT fine-tuning script
    ├── scripts/
    │   └── generate_dataset.py    # Synthetic complaint dataset generator
    ├── data/
    │   └── complaints.csv         # 4,250-row synthetic training dataset
    └── models/                    # Local checkpoint storage (HF-hosted backup)
```

---

## 4. Quick Start

### Prerequisites

- **Node.js** 18+ (for backend)
- **Python** 3.9+ (for AI service)
- **MySQL** 8+ (database server)
- **Git** (for cloning repository)
- Optional: CUDA GPU for faster model training

### 4.1 Database Setup

```bash
mysql -u root -p < database/schema.sql
```

This command:
- Creates `smart_complaints` database
- Sets up all tables (users, departments, categories, complaints, etc.)
- Inserts seed data (departments, categories, priorities)
- Creates admin user: `admin@scms.com` / `Admin@123`

### 4.2 AI Service Setup & Deployment

```bash
cd ai-service

# Create Python virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Regenerate synthetic training dataset
python -m scripts.generate_dataset --out data/complaints.csv --per-category 250

# Fine-tune the multi-task DistilBERT model
python -m training.train --data data/complaints.csv \
       --epochs 3 --batch-size 16 --lr 2e-5 \
       --out models/complaint_multitask.pt

# Serve the FastAPI service locally
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**AI Service Output Example:**
```json
{
  "category": "Water Supply",
  "priority": "High",
  "department": "Maintenance",
  "sentiment": "Negative",
  "confidence": 0.94,
  "model_version": "distilbert-multitask-v1",
  "trained": true,
  "processing_time_ms": 142
}
```

**Production Deployment:**
- Upload trained model checkpoint to Hugging Face Model Hub
- AI service automatically downloads during startup
- No local file storage needed on Render
- Automatic cache management for subsequent requests

> **Note:** If the model hasn't been trained, the service still runs and returns keyword-based fallback predictions with `trained: false` — allowing full-stack development without waiting for training.

### 4.3 Backend Setup

```bash
cd backend

# Copy environment template and configure
cp .env.example .env
# Edit .env with MySQL credentials, JWT secret, Render backend URL, AI service endpoint

# Install Node dependencies
npm install

# Seed database with demo users
npm run seed

# Start backend server
npm start
```

Backend runs on `http://localhost:5000` and serves:
- REST API at `/api/*`
- Frontend SPA at `/`

**Demo Credentials (created by `npm run seed`):**

| Role  | Email              | Password  | Department  |
|-------|--------------------|-----------|-------------|
| ADMIN | admin@scms.com     | Admin@123 | System      |
| STAFF | maint@scms.com     | Staff@123 | Maintenance |
| STAFF | it@scms.com        | Staff@123 | IT Support  |
| USER  | rahul@scms.com     | User@123  | —           |
| USER  | priya@scms.com     | User@123  | —           |

### 4.4 Open the Application

**Local Development:**
```
Visit http://localhost:5000
```

**Production (Render):**
```
Visit https://scms-backend-wll3.onrender.com
```

The vanilla-JavaScript SPA is served from the same host as the backend.

---

## 5. User Roles & Features

### USER (Complaint Submitter)
- ✅ Register / Login with JWT token
- ✅ Submit complaint with optional image attachment
- ✅ **Real-time AI preview** of complaint analysis before submission
- ✅ Track complaint status lifecycle (SUBMITTED → AI_ANALYZED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED)
- ✅ Add comments and updates to own complaints
- ✅ Rate resolved complaints (1–5 stars)
- ✅ Reopen complaint if resolution unsatisfactory

### STAFF (Department Representatives)
- ✅ View complaints assigned to their department
- ✅ Filter by status, priority, category, date range
- ✅ Update complaint status with status history tracking
- ✅ Add internal notes (not visible to users)
- ✅ Add resolution message (visible to users)
- ✅ Assign complaints to colleagues
- ✅ View department analytics (volume, trends, resolution time)

### ADMIN (System Administrator)
- ✅ Full complaint management and override authority
- ✅ Manage all users (create, edit, deactivate)
- ✅ Manage staff and department assignments
- ✅ Create/edit departments and complaint categories
- ✅ Manage priority levels and business rules
- ✅ **Override AI predictions** (change category, priority, department, assignee)
- ✅ **Comprehensive Analytics Dashboard:**
  - Complaint volume breakdown by category, priority, department, sentiment
  - 30-day complaint trend analysis
  - AI model performance metrics (avg confidence, latency, total predictions)
  - Duplicate detection rate
  - Average resolution time
  - User satisfaction ratings
- ✅ Live AI service health indicator

---

## 6. Complaint Lifecycle

```
SUBMITTED (user creates complaint)
    ↓
AI ANALYSIS (Python FastAPI classifies + checks duplicates)
    ↓
CLASSIFIED (AI predictions assigned)
    ↓
ASSIGNED (admin or auto-assigned by department mapping)
    ↓
IN_PROGRESS (staff acknowledges and begins work)
    ↓
RESOLVED (staff provides resolution)
    ↓
CLOSED (user confirms or complaint auto-closes)
    ↓
REOPENED (if user not satisfied with resolution)
```

**Tracking:** Every state change is logged in `complaint_status_history` with timestamp and actor information.

---

## 7. API Reference

### Authentication Endpoints
```
POST   /api/auth/register          Create new user account
POST   /api/auth/login             Get JWT token
GET    /api/auth/me                Get current user profile
POST   /api/auth/logout            Invalidate session
```

### Complaint Endpoints (User)
```
POST   /api/complaints/predict     Get AI preview (no database save)
POST   /api/complaints             Create complaint (AI analysis + dup-check)
GET    /api/complaints             List user's complaints (role-filtered)
GET    /api/complaints/:id         Get complaint details
POST   /api/complaints/:id/comments Add comment to complaint
POST   /api/complaints/:id/rate    Rate resolved complaint (1-5 stars)
POST   /api/complaints/:id/reopen  Reopen complaint if unsatisfied
```

### Complaint Endpoints (Staff/Admin)
```
PATCH  /api/complaints/:id/status  Update complaint status
PATCH  /api/complaints/:id/assign  Assign to staff member
GET    /api/complaints/:id/history View status change history
```

### Admin Endpoints
```
GET    /api/admin/users            List all users
POST   /api/admin/users            Create new user
PATCH  /api/admin/users/:id        Update user role/status
DELETE /api/admin/users/:id        Deactivate user

GET    /api/admin/departments      List departments
POST   /api/admin/departments      Create department
PATCH  /api/admin/departments/:id  Update department
DELETE /api/admin/departments/:id  Delete department

GET    /api/admin/categories       List complaint categories
POST   /api/admin/categories       Create category
PATCH  /api/admin/categories/:id   Update category
DELETE /api/admin/categories/:id   Delete category

GET    /api/admin/priorities       List priority levels
GET    /api/admin/analytics        Get dashboard metrics
GET    /api/admin/ai-health        Check AI service status
```

### AI Microservice Endpoints (Internal)
```
GET    /health                     Service health check
POST   /predict                    Predict category/priority/sentiment
POST   /duplicate-check            Find duplicate complaints
GET    /model/info                 Get model version & performance metrics
```

---

## 8. Key Features for Resume/Portfolio

### Advanced Machine Learning
- ✅ **Multi-task deep learning model** with shared DistilBERT backbone
- ✅ **Three specialized classification heads** (category, priority, sentiment)
- ✅ **Custom multi-task loss function** for balanced training
- ✅ **Sentence embeddings** (MiniLM) for semantic duplicate detection
- ✅ **Model deployment strategy** using Hugging Face Model Hub (prevents resource exhaustion)

### System Architecture & Integration
- ✅ **Microservices architecture** — separate Python AI service + Node.js backend
- ✅ **HTTP-based communication** with graceful error handling and fallback predictions
- ✅ **Async processing** — complaint analysis runs independently with status polling
- ✅ **AI service health monitoring** — real-time health checks with dashboard indicator

### Production-Grade Security & Reliability
- ✅ **JWT authentication** with role-based access control (RBAC)
- ✅ **Password security** — bcrypt hashing with salt
- ✅ **Rate limiting** — DDoS protection with express-rate-limit
- ✅ **Input validation** — express-validator + sanitization
- ✅ **Security headers** — Helmet.js for HTTP security
- ✅ **Database integrity** — foreign keys, cascade deletes, indexes
- ✅ **Audit logging** — comprehensive status and action history

### Analytics & Business Intelligence
- ✅ **Interactive dashboards** with Chart.js
- ✅ **Real-time metrics** — complaint volume, trends, department stats
- ✅ **AI performance tracking** — model confidence, latency, accuracy
- ✅ **Business metrics** — resolution time, user satisfaction, duplicate rate
- ✅ **30-day trend analysis** — historical data visualization

### Frontend Technologies
- ✅ **Vanilla JavaScript** — no framework bloat, direct DOM manipulation
- ✅ **Single Page Application (SPA)** — client-side routing
- ✅ **Responsive design** — mobile-first, works on all devices
- ✅ **Chart.js integration** — real-time analytics visualizations
- ✅ **Role-based UI** — different views for USER/STAFF/ADMIN

### Database Design
- ✅ **Normalized schema** — BCNF compliance, no data redundancy
- ✅ **Proper indexing** — fast queries on frequently filtered columns
- ✅ **Foreign key constraints** — referential integrity
- ✅ **Audit trail** — `complaint_status_history` for compliance

---

## 9. Environment Configuration

### Backend `.env` Example
```env
# Database
DB_HOST=your-mysql-host.com
DB_USER=root
DB_PASSWORD=YourStrongPassword
DB_NAME=smart_complaints
DB_PORT=3306

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# AI Service
AI_SERVICE_URL=https://your-ai-service.onrender.com
AI_SERVICE_TIMEOUT=30000

# Server
NODE_ENV=production
PORT=5000
RENDER_BACKEND_URL=https://scms-backend-wll3.onrender.com

# Logging
LOG_LEVEL=info
```

### AI Service `.env` Example
```env
# Model Configuration
MODEL_NAME=distilbert-base-uncased
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
HUGGINGFACE_TOKEN=your-hf-token-for-private-models

# Performance
BATCH_SIZE=32
NUM_WORKERS=4
MAX_LENGTH=512

# Deployment
DEBUG=false
PORT=8000
```

---

## 10. Deployment on Render

### Backend Deployment
1. Push code to GitHub repository
2. Create new Web Service on Render
3. Connect GitHub repo
4. Set environment variables in Render dashboard
5. Set build command: `cd backend && npm install`
6. Set start command: `npm start`
7. Deploy

### AI Service Deployment
1. Create new Web Service on Render for Python
2. Set build command: `cd ai-service && pip install -r requirements.txt`
3. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
4. Allocate appropriate resources (models are auto-downloaded from Hugging Face)

---

## 11. License & Attribution

**Developed by: Sonam Kumari**

This project is for educational and portfolio demonstration purposes.

Feel free to use, modify, and share for learning and professional showcasing.

---

## 12. Support & Contact

For questions or issues:
1. Check existing GitHub Issues
2. Review the detailed `ai-service/README_MODEL.md` for model-specific questions
3. Create a new Issue with detailed description and steps to reproduce

---

**Live Demo:** [https://scms-backend-wll3.onrender.com](https://scms-backend-wll3.onrender.com)

**GitHub Repository:** [https://github.com/Sonamkumari-git/smart-complaint-system](https://github.com/Sonamkumari-git/smart-complaint-system)
