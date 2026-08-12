# Mini ERP + CRM Operations Portal — Project Status Report

**Repository:** https://github.com/TanmayRaoH/ERP_PORTAL  
**Live Application:** https://erpportal2.netlify.app  
**Backend API:** https://erp-portal-umo0.onrender.com  
**Report Date:** August 12, 2026  
**Report Type:** Verified from actual codebase — no assumptions made

> **Demo Login:** Email: `admin@erp.com` | Password: `admin123`  
> ⚠️ Backend is on Render free tier — first load after idle may take 30–60 seconds (cold start).

---

## 1. Project Overview

A full-stack Mini ERP + CRM Operations Portal has been built to manage products, customers, and sales challans with role-based access control. The system supports four user roles (Admin, Sales, Warehouse, Accounts) each with distinct permissions enforced at both the API and UI layers. The backend exposes a RESTful JSON API with JWT authentication, Zod input validation, and MySQL transactions for the critical stock-deduction flow. The frontend is a single-page React application with a responsive sidebar layout, paginated data tables, and role-aware navigation. All core modules from the spec — authentication, customer CRM, product inventory, and sales challans — are fully implemented and deployed.

**Final Tech Stack:**

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 24 + TypeScript + Express 4 |
| ORM / DB Driver | mysql2/promise (raw SQL, no ORM) |
| Validation | Zod 3 |
| Auth | jsonwebtoken (JWT, Bearer token) |
| Password Hashing | bcryptjs (cost factor 12) |
| Frontend | React 18 + TypeScript + Vite 5 |
| Styling | Tailwind CSS 3 |
| Data Fetching | TanStack React Query 5 + Axios |
| Forms | React Hook Form 7 + Zod resolvers |
| Database | MySQL 8 / 9 (Railway hosted) |
| Backend Deployment | Render Free Web Service |
| Frontend Deployment | Netlify Free |
| Database Hosting | Railway (MySQL plugin) |

---

## 2. Module-by-Module Status

### a) Authentication & Roles

| Requirement | Status |
|-------------|--------|
| Login functionality | ✅ `POST /auth/login` with email + password |
| JWT-based authentication | ✅ `jsonwebtoken`, Bearer token, 7-day expiry |
| Admin role | ✅ Full access to everything |
| Sales role | ✅ Customers + own challans + read products |
| Warehouse role | ✅ Products + stock + confirm challans |
| Accounts role | ✅ Read-only across all modules |

---

### b) Customer CRM

**Customer fields:**

| Field | Status |
|-------|--------|
| Customer name | ✅ |
| Mobile number | ✅ |
| Email | ✅ |
| Business name | ✅ |
| GST number (optional) | ✅ nullable |
| Customer type (Retail / Wholesale / Distributor) | ✅ ENUM |
| Address | ✅ |
| Status (Lead / Active / Inactive) | ✅ ENUM, default Lead |
| Follow-up date | ✅ DATE field |
| Notes | ✅ `customer_notes` table |

**Required features:**

| Feature | Status |
|---------|--------|
| Add customer | ✅ `POST /customers` + `/customers/new` page |
| Edit customer | ✅ `PUT /customers/:id` + `/customers/:id/edit` page |
| Search customer | ✅ LIKE search on name / mobile / email / business name |
| View customer detail page | ✅ `/customers/:id` with full info |
| Add follow-up notes | ✅ `POST /customers/:id/notes` + notes section on detail page |

---

### c) Product & Inventory

**Product fields:**

| Field | Status |
|-------|--------|
| Product name | ✅ |
| SKU / code | ✅ unique |
| Category | ✅ |
| Unit price | ✅ DECIMAL(10,2) |
| Current stock | ✅ INT, default 0 |
| Minimum stock alert quantity | ✅ `min_stock_alert` field |
| Location / warehouse | ✅ `location` field |

**Required features:**

| Feature | Status |
|---------|--------|
| Add product | ✅ `POST /products` + `/products/new` page |
| Edit product | ✅ `PUT /products/:id` + `/products/:id/edit` page |

**Stock movement log fields:**

| Field | Status |
|-------|--------|
| Product | ✅ `product_id` FK → products |
| Quantity changed | ✅ `quantity_changed` INT |
| Movement type (IN / OUT) | ✅ ENUM('IN','OUT') |
| Reason | ✅ `reason` VARCHAR |
| Created by | ✅ `created_by` FK → users |
| Timestamp | ✅ `created_at` TIMESTAMP |

---

### d) Sales Challan

**Sales user can:**

| Action | Status |
|--------|--------|
| Select customer | ✅ customer dropdown in challan creation |
| Add multiple products | ✅ ProductPicker with live search |
| Add quantity for each product | ✅ per-item quantity input |
| Generate challan number automatically | ✅ format `CH-000001` |
| Save as Draft or Confirmed | ✅ created as Draft; warehouse/admin confirms |

**Important business logic:**

| Rule | Status |
|------|--------|
| Stock reduced on confirm | ✅ DB transaction deducts stock per item on confirm |
| Stock cannot go negative | ✅ checked before deduction, entire transaction rolls back on failure |
| Insufficient stock returns proper error | ✅ 409 response with `{ product_name, available, requested }` per failing item |
| Product snapshot stored (not just ID) | ✅ `product_name_snapshot`, `sku_snapshot`, `unit_price_snapshot` on `challan_items` |

**Challan fields:**

| Field | Status |
|-------|--------|
| Challan number | ✅ auto-generated (`CH-000001` format) |
| Customer | ✅ FK → customers, name joined on all reads |
| Products | ✅ `challan_items` table with snapshots |
| Total quantity | ✅ stored and updated on edit |
| Status (Draft / Confirmed / Cancelled) | ✅ ENUM, full flow implemented |
| Created by | ✅ FK → users |
| Created date | ✅ `created_at` TIMESTAMP |

**Stock deduction transaction detail (verified in code):**
1. Opens dedicated DB connection, calls `BEGIN TRANSACTION`
2. Locks challan row with `FOR UPDATE`
3. Guards: status must be `draft`, challan must have items
4. Calls `checkStockAvailability()` — locks each product row with `FOR UPDATE`, checks `current_stock >= quantity` for every item
5. On any failure: rolls back entire transaction, returns 409 with array of `{ product_name, available, requested }` for every failing item
6. On success: calls `deductStockForChallan()` — `UPDATE products SET current_stock = current_stock - ?` per item + inserts `stock_movements` record (type `OUT`, reason `challan CH-XXXXXX`)
7. Updates challan status to `confirmed`, sets `confirmed_at = CURRENT_TIMESTAMP`
8. Commits transaction

---

## 3. API Routes — Actual vs Planned

### Auth Routes

| Method | Path | Validation | Auth | Role | Status |
|--------|------|-----------|------|------|--------|
| POST | `/auth/login` | ✅ Zod | ❌ | ❌ | ✅ Implemented |
| GET | `/auth/me` | ❌ | ✅ | ❌ | ✅ Implemented |

### Customer Routes

| Method | Path | Validation | Auth | Role | Status |
|--------|------|-----------|------|------|--------|
| GET | `/customers` | ❌ query only | ✅ | ❌ | ✅ Implemented |
| GET | `/customers/:id` | ❌ | ✅ | ❌ | ✅ Implemented |
| POST | `/customers` | ✅ Zod | ✅ | sales, admin | ✅ Implemented |
| PUT | `/customers/:id` | ✅ Zod partial | ✅ | sales, admin | ✅ Implemented |
| POST | `/customers/:id/notes` | ✅ Zod | ✅ | sales, admin | ✅ Implemented |
| GET | `/customers/:id/notes` | ❌ | ✅ | ❌ | ✅ Implemented |

### Product Routes

| Method | Path | Validation | Auth | Role | Status |
|--------|------|-----------|------|------|--------|
| GET | `/products` | ❌ query only | ✅ | ❌ | ✅ Implemented |
| GET | `/products/:id` | ❌ | ✅ | ❌ | ✅ Implemented |
| POST | `/products` | ✅ Zod | ✅ | warehouse, admin | ✅ Implemented |
| PUT | `/products/:id` | ✅ Zod partial | ✅ | warehouse, admin | ✅ Implemented |
| GET | `/products/:id/stock-movements` | ❌ query only | ✅ | ❌ | ✅ Implemented |
| POST | `/products/:id/stock-movements` | ✅ Zod | ✅ | warehouse, admin | ✅ Implemented |

### Challan Routes

| Method | Path | Validation | Auth | Role | Status |
|--------|------|-----------|------|------|--------|
| GET | `/challans` | ❌ query only | ✅ | ❌ (sales scoped) | ✅ Implemented |
| GET | `/challans/:id` | ❌ | ✅ | ❌ (sales scoped) | ✅ Implemented |
| POST | `/challans` | ✅ Zod | ✅ | sales, admin | ✅ Implemented |
| PUT | `/challans/:id` | ✅ Zod partial | ✅ | sales, admin | ✅ Implemented |
| POST | `/challans/:id/confirm` | ❌ (no body) | ✅ | warehouse, admin | ✅ Implemented |
| POST | `/challans/:id/cancel` | ❌ (no body) | ✅ | sales, warehouse, admin | ✅ Implemented |

### User Routes

| Method | Path | Validation | Auth | Role | Status |
|--------|------|-----------|------|------|--------|
| GET | `/users` | ❌ | ✅ | admin | ✅ Implemented |
| POST | `/users` | ✅ Zod | ✅ | admin | ✅ Implemented |

### Utility Routes

| Method | Path | Status |
|--------|------|--------|
| GET | `/health` | ✅ Implemented (returns `{ status: "ok", timestamp }`) |

**Routes from spec NOT implemented:** None. All routes specified in Section 3 of the original spec are present and functional.

---

## 4. Database Schema — As Built

All 7 tables match the spec exactly. Differences from spec noted below.

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | CHAR(36) PK | UUID(), matches spec |
| name | VARCHAR(255) NOT NULL | matches spec |
| email | VARCHAR(255) UNIQUE NOT NULL | matches spec |
| password_hash | VARCHAR(255) NOT NULL | bcrypt, matches spec |
| role | ENUM('admin','sales','warehouse','accounts') | matches spec |
| created_at | TIMESTAMP DEFAULT NOW | matches spec |

### `customers`
| Column | Type | Notes |
|--------|------|-------|
| id | CHAR(36) PK | matches spec |
| name | VARCHAR(255) NOT NULL | matches spec |
| mobile | VARCHAR(20) NOT NULL | matches spec |
| email | VARCHAR(255) | nullable, matches spec |
| business_name | VARCHAR(255) | nullable, matches spec |
| gst_number | VARCHAR(20) | nullable, matches spec |
| customer_type | ENUM('retail','wholesale','distributor') | matches spec |
| address | TEXT NOT NULL | matches spec |
| status | ENUM('lead','active','inactive') DEFAULT 'lead' | matches spec |
| follow_up_date | DATE | nullable, matches spec |
| created_by | CHAR(36) FK → users RESTRICT | matches spec |
| created_at | TIMESTAMP | matches spec |
| updated_at | TIMESTAMP ON UPDATE | matches spec |

### `customer_notes`
| Column | Type | Notes |
|--------|------|-------|
| id | CHAR(36) PK | matches spec |
| customer_id | CHAR(36) FK → customers CASCADE | matches spec |
| note | TEXT NOT NULL | matches spec |
| created_by | CHAR(36) FK → users RESTRICT | matches spec |
| created_at | TIMESTAMP | matches spec |

### `products`
| Column | Type | Notes |
|--------|------|-------|
| id | CHAR(36) PK | matches spec |
| name | VARCHAR(255) NOT NULL | matches spec |
| sku | VARCHAR(100) UNIQUE NOT NULL | matches spec |
| category | VARCHAR(100) NOT NULL | matches spec |
| unit_price | DECIMAL(10,2) NOT NULL | spec says `numeric(10,2)` — MySQL equivalent ✅ |
| current_stock | INT DEFAULT 0 | matches spec |
| min_stock_alert | INT DEFAULT 0 | matches spec |
| location | VARCHAR(255) DEFAULT '' | matches spec |
| created_at | TIMESTAMP | matches spec |
| updated_at | TIMESTAMP ON UPDATE | matches spec |

### `stock_movements`
| Column | Type | Notes |
|--------|------|-------|
| id | CHAR(36) PK | matches spec |
| product_id | CHAR(36) FK → products RESTRICT | matches spec |
| quantity_changed | INT NOT NULL | matches spec |
| movement_type | ENUM('IN','OUT') NOT NULL | matches spec |
| reason | VARCHAR(255) NOT NULL | matches spec |
| created_by | CHAR(36) FK → users RESTRICT | matches spec |
| created_at | TIMESTAMP | matches spec |

### `challans`
| Column | Type | Notes |
|--------|------|-------|
| id | CHAR(36) PK | matches spec |
| challan_number | VARCHAR(20) UNIQUE NOT NULL | matches spec |
| customer_id | CHAR(36) FK → customers RESTRICT | matches spec |
| total_quantity | INT DEFAULT 0 | matches spec |
| status | ENUM('draft','confirmed','cancelled') DEFAULT 'draft' | matches spec |
| created_by | CHAR(36) FK → users RESTRICT | matches spec |
| created_at | TIMESTAMP | matches spec |
| confirmed_at | TIMESTAMP NULL | matches spec |

### `challan_items`
| Column | Type | Notes |
|--------|------|-------|
| id | CHAR(36) PK | matches spec |
| challan_id | CHAR(36) FK → challans CASCADE | matches spec |
| product_id | CHAR(36) FK → products RESTRICT | matches spec |
| product_name_snapshot | VARCHAR(255) NOT NULL | matches spec |
| sku_snapshot | VARCHAR(100) NOT NULL | matches spec |
| unit_price_snapshot | DECIMAL(10,2) NOT NULL | matches spec |
| quantity | INT NOT NULL | matches spec |

**Schema differences from spec:** None. All tables, columns, types, constraints, and foreign keys match the original specification exactly.

---

## 5. Frontend — Pages Built

| Route | Component | Functional | Notes |
|-------|-----------|-----------|-------|
| `/login` | `LoginPage` | ✅ | Form validation, demo credentials shown |
| `/dashboard` | `DashboardPage` | ✅ | Stats cards, low stock widget, follow-up widget, draft challans widget — all role-aware |
| `/products` | `ProductListPage` | ✅ | Search, category filter, pagination, low-stock alert icons |
| `/products/new` | `ProductFormPage` | ✅ | Create form with all fields, SKU duplicate check |
| `/products/:id` | `ProductDetailPage` | ✅ | Product info, stock movement form, paginated movement history |
| `/products/:id/edit` | `ProductFormPage` | ✅ | Edit form (current_stock disabled, use movements) |
| `/challans` | `ChallanListPage` | ✅ | Status tab filter, pagination |
| `/challans/new` | `ChallanNewPage` | ✅ | Customer dropdown, ProductPicker with live search |
| `/challans/:id` | `ChallanDetailPage` | ✅ | Detail view, inline edit mode, confirm/cancel buttons, stock error display |
| `/customers` | `CustomerListPage` | ✅ | Search, status filter, pagination |
| `/customers/new` | `CustomerFormPage` | ✅ | Full create form |
| `/customers/:id` | `CustomerDetailPage` | ✅ | Detail view, notes list, add note form, follow-up date highlight |
| `/customers/:id/edit` | `CustomerFormPage` | ✅ | Edit form pre-populated |
| `/users` | `UsersPage` | ✅ | Admin only — user list + inline create form |

**All 14 routes are functional.** No stub or placeholder pages.

**Shared components built:**
- `Layout` — responsive sidebar, mobile hamburger menu, user info + logout
- `DataTable` — pagination, search input, loading skeleton, empty state
- `ProductPicker` — live product search dropdown, quantity editor, subtotal/total calculation
- `StatusBadge` — color-coded badges for all status/role/type values
- `RoleGuard` — wraps routes, redirects or shows access-denied message

---

## 6. Deployment Status

| Service | Status | URL |
|---------|--------|-----|
| Backend (Render) | ✅ Live | https://erp-portal-umo0.onrender.com |
| Frontend (Netlify) | ✅ Live | https://erpportal2.netlify.app |
| Database (Railway MySQL) | ✅ Connected | sakura.proxy.rlwy.net:26613 |
| Health check | ✅ Responding | https://erp-portal-umo0.onrender.com/health |

**Verified working end-to-end:** Login API returns JWT token. All 7 database tables created. Admin seed user present.

**Known deployment issues:**
- Render free tier spins down after ~15 minutes of inactivity. First request after idle takes 30–60 seconds (cold start). This is expected behavior of the free tier, documented in README.
- Railway free trial has a 30-day/$5 credit limit — database will need migration to Aiven or Clever Cloud for long-term free hosting.

---

## 7. Testing Status

**All modules manually tested and verified working via browser and API calls.**

| Endpoint / Feature | Method | Tested | Result |
|--------------------|--------|--------|--------|
| Login | `POST /auth/login` | ✅ | Returns JWT token |
| Get current user | `GET /auth/me` | ✅ | Returns user profile |
| Create customer | `POST /customers` | ✅ | Customer created |
| Edit customer | `PUT /customers/:id` | ✅ | Customer updated |
| Search customer | `GET /customers?search=` | ✅ | Results filtered correctly |
| View customer detail | `GET /customers/:id` | ✅ | Full detail returned |
| Add customer note | `POST /customers/:id/notes` | ✅ | Note saved and displayed |
| Add product | `POST /products` | ✅ | Product created |
| Edit product | `PUT /products/:id` | ✅ | Product updated |
| Stock movement IN | `POST /products/:id/stock-movements` | ✅ | Stock incremented |
| Stock movement OUT | `POST /products/:id/stock-movements` | ✅ | Stock decremented |
| Negative stock guard | `POST /products/:id/stock-movements` | ✅ | Returns 422 error |
| Create draft challan | `POST /challans` | ✅ | Draft created with snapshot |
| Edit draft challan | `PUT /challans/:id` | ✅ | Items updated |
| Confirm challan | `POST /challans/:id/confirm` | ✅ | Stock deducted, status → confirmed |
| Cancel challan | `POST /challans/:id/cancel` | ✅ | Status → cancelled |
| Insufficient stock on confirm | `POST /challans/:id/confirm` | ✅ | Returns 409 with product details |
| Create user | `POST /users` | ✅ | User created with hashed password |
| Role-based access | All routes | ✅ | Correct 403 for unauthorized roles |
| Health check | `GET /health` | ✅ | Returns `{ status: "ok" }` |

**Testing method:** Manual testing via browser UI (https://erpportal2.netlify.app) and direct API calls.

**No known broken endpoints.**

---

## 8. Known Limitations / Not Yet Done

### Bonus Features Not Attempted
- ❌ Docker / docker-compose setup
- ❌ CI/CD pipeline (GitHub Actions)
- ❌ PDF export of challans or invoices
- ❌ S3 / cloud image upload for product photos
- ❌ Email notifications (follow-up reminders, challan confirmation)
- ❌ Dashboard analytics charts (revenue trends, top products)



### Business Logic Gaps
- Stock is **not reversed** when a confirmed challan is cancelled — spec does not explicitly require this but it is a realistic requirement
- No GST calculation — GST number stored on customer but never used in any computation
- Single currency only — no multi-currency support
- `challan_number` generation is not atomic under concurrent creation — sequential query-based approach works at small scale
- No `total_amount` stored on challans — must be recomputed from line items each time



### Infrastructure
- No rate limiting on API endpoints
- No request logging middleware (morgan/winston)
- No helmet.js for security headers
- CORS allows all `*.netlify.app` subdomains — should be locked to exact domain in production

---

## 9. Suggested Improvements (Prioritized)

| Priority | Improvement | Impact |
|----------|-------------|--------|
| 1 | **Stock reversal on confirmed challan cancel** | Correctness — prevents phantom stock loss |
| 2 | **Postman collection** | Demonstrates API coverage to evaluators |
| 3 | **Rate limiting + helmet.js** | Security hardening, low effort |
| 4 | **Zod validation on query params** | Consistent error handling across all endpoints |
| 5 | **Morgan request logging** | Debugging and observability |
| 6 | **Atomic challan number generation** | Use `SELECT MAX() + 1 FOR UPDATE` or a dedicated sequence table |
| 7 | **`total_amount` on challans table** | Avoid recomputation, enables server-side reporting |
| 8 | **PDF challan export** | High value for real business use (use `pdfkit` or `puppeteer`) |
| 9 | **GitHub Actions CI** | Auto-run build + TypeScript check on every push |
| 10 | **Dashboard charts** | Revenue/stock trends using Recharts or Chart.js |
