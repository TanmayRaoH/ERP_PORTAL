# Mini ERP + CRM Operations Portal — Project Status Report

**Repository:** https://github.com/TanmayRaoH/ERP_PORTAL  
**Report Date:** August 12, 2026  
**Report Type:** Verified from actual codebase — no assumptions made

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

**Fully Implemented ✅**
- `POST /auth/login` — email + password login, returns signed JWT with `{ userId, email, role }` payload
- `GET /auth/me` — returns current user profile from token
- `requireAuth` middleware — validates Bearer token on every protected route
- `requireRole(...roles)` middleware — enforces role-based access at route level
- All four roles exist: `admin`, `sales`, `warehouse`, `accounts`
- Frontend login page with form validation (Zod + React Hook Form)
- Auth context with `localStorage` token persistence
- Axios interceptor auto-attaches token to every API request
- Auto-redirect to `/login` on 401 responses
- `RoleGuard` component wraps protected frontend routes
- Sidebar navigation filters items by role
- Admin-only Users page to create new employee logins
- Password hashed with bcryptjs cost 12

**Partially Implemented ⚠️**
- `req.user.name` is set to empty string `''` in `requireAuth` middleware — name is decoded from token payload but the token only stores `userId`, `email`, `role`. Name requires a DB lookup which is not done in middleware (acceptable for performance, but `req.user.name` is always `''` in route handlers).

**Skipped ❌**
- Password reset / forgot password flow
- Token refresh / sliding expiry
- Login rate limiting / brute-force protection
- Audit log of login events

---

### b) Customer CRM

**Fully Implemented ✅**
- Full CRUD: `GET /customers`, `GET /customers/:id`, `POST /customers`, `PUT /customers/:id`
- Pagination on list endpoint (`page`, `limit` capped at 100)
- Search across `name`, `mobile`, `business_name`, `email` (LIKE-based)
- Status filter (`lead`, `active`, `inactive`)
- Customer notes: `POST /customers/:id/notes`, `GET /customers/:id/notes`
- `follow_up_date` field stored and displayed
- Dashboard widget shows overdue follow-ups (follow-up date ≤ today)
- `created_by_name` joined from users table on all reads
- Role enforcement: sales + admin can write; all roles can read
- Frontend: list page, create form, detail page with notes section, edit form
- Status badge component for visual status display
- Follow-up date highlights in red when overdue

**Partially Implemented ⚠️**
- No pagination on `GET /customers/:id/notes` — returns all notes for a customer (no limit/offset)
- Search is LIKE-based only — no full-text search index

**Skipped ❌**
- Customer deletion endpoint (not in spec, not built)
- Bulk import of customers
- Customer activity timeline (aggregating notes + challans in one view)

---

### c) Product & Inventory

**Fully Implemented ✅**
- Full CRUD: `GET /products`, `GET /products/:id`, `POST /products`, `PUT /products/:id`
- Pagination on list with `search` (name/SKU LIKE) and `category` filter
- Stock movements: `GET /products/:id/stock-movements`, `POST /products/:id/stock-movements`
- Manual IN/OUT stock movement runs inside a DB transaction with `FOR UPDATE` row lock
- Negative-stock guard on manual OUT movements — returns 422 `INSUFFICIENT_STOCK` with exact available/requested figures
- `min_stock_alert` threshold stored per product
- Dashboard low-stock widget shows products where `current_stock ≤ min_stock_alert`
- `current_stock` cannot be directly edited via PUT — only adjustable via stock movement endpoint
- Role enforcement: warehouse + admin write; all roles read
- Frontend: list with alert icons for low stock, product detail with movement history, create/edit form

**Partially Implemented ⚠️**
- No image/photo field for products (spec listed S3 upload as bonus — not implemented)
- Category is a free-text `VARCHAR(100)` — no category master table or dropdown enforcement

**Skipped ❌**
- Product deletion endpoint
- Bulk stock import
- Stock valuation report

---

### d) Sales Challan

**Fully Implemented ✅**

| Requirement | Status |
|-------------|--------|
| Create draft challan with items | ✅ |
| Edit draft challan (items + customer) | ✅ |
| Confirm challan — stock deduction transaction | ✅ |
| Negative-stock guard on confirm | ✅ |
| Product snapshot on `challan_items` | ✅ |
| `draft` → `confirmed` → `cancelled` status flow | ✅ |
| Cancel challan | ✅ |
| Sales role scope (only own challans) | ✅ |
| Auto-generated challan number (CH-000001 format) | ✅ |
| Pagination + status filter on list | ✅ |

**Stock deduction transaction detail (verified in code):**
1. Opens dedicated DB connection, calls `BEGIN TRANSACTION`
2. Locks challan row with `FOR UPDATE`
3. Guards: status must be `draft`, challan must have items
4. Calls `checkStockAvailability()` — locks each product row with `FOR UPDATE`, checks `current_stock >= quantity` for every item
5. On any failure: rolls back entire transaction, returns 409 with array of `{ product_name, available, requested }` for every failing item
6. On success: calls `deductStockForChallan()` — `UPDATE products SET current_stock = current_stock - ?` per item + inserts `stock_movements` record (type `OUT`, reason `challan CH-XXXXXX`)
7. Updates challan status to `confirmed`, sets `confirmed_at = CURRENT_TIMESTAMP`
8. Commits transaction

**Product snapshot verified:** `challan_items` stores `product_name_snapshot`, `sku_snapshot`, `unit_price_snapshot` captured at creation time from live product data. Historical challans are never affected by product edits.

**Partially Implemented ⚠️**
- Challan number generation uses `ORDER BY created_at DESC LIMIT 1` — not atomic under high concurrency (acceptable for this scale)
- No invoice total stored on challan — `total_quantity` stored but not `total_amount` (line item totals computed on frontend from snapshots)

**Skipped ❌**
- PDF export of challan/invoice
- Challan duplication feature
- Stock reversal on cancel of confirmed challan (stock is not returned when a confirmed challan is cancelled)

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

**Manual API testing verified working:**
- `POST /auth/login` — returns JWT ✅
- `GET /health` — returns `{ status: "ok" }` ✅
- `GET /products` — returns paginated list ✅
- `GET /customers` — returns paginated list ✅
- `GET /challans` — returns paginated list ✅

**No Postman collection created.** Testing was done via PowerShell `Invoke-RestMethod` during development and deployment verification.

**Known untested or unverified endpoints:**
- `PUT /customers/:id` — logic verified in code, not manually tested via HTTP
- `PUT /challans/:id` (edit draft) — logic verified in code, frontend tested
- `POST /products/:id/stock-movements` with OUT type causing negative stock — unit tested in code logic, not via HTTP call
- `GET /users` and `POST /users` — frontend tested only
- Concurrent challan confirms (race condition safety) — not load tested

---

## 8. Known Limitations / Not Yet Done

### Bonus Features Not Attempted
- ❌ Docker / docker-compose setup
- ❌ CI/CD pipeline (GitHub Actions)
- ❌ PDF export of challans or invoices
- ❌ S3 / cloud image upload for product photos
- ❌ Email notifications (follow-up reminders, challan confirmation)
- ❌ Dashboard analytics charts (revenue trends, top products)

### Validation Gaps
- Query parameters on GET list endpoints (page, limit, search, category, status) are not validated with Zod — invalid values fall back to defaults silently
- No UUID format validation on route params (`:id`) — invalid IDs hit the DB and return 404 which is acceptable but not explicit
- `follow_up_date` accepts any string — date format not validated server-side

### Business Logic Gaps
- Stock is **not reversed** when a confirmed challan is cancelled — spec does not explicitly require this but it is a realistic requirement
- No GST calculation — GST number stored on customer but never used in any computation
- Single currency only — no multi-currency support
- `challan_number` generation is not atomic under concurrent creation — sequential query-based approach works at small scale
- No `total_amount` stored on challans — must be recomputed from line items each time

### UI Polish Skipped
- No loading skeletons on individual pages (only the DataTable has a loader)
- No confirmation dialogs beyond `window.confirm()` for destructive actions
- No toast for successful form navigation (only success toast on save)
- Mobile layout is functional but not deeply optimized
- No dark mode
- No keyboard shortcuts or accessibility audit

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
