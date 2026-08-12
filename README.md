# Mini ERP + CRM Operations Portal

A full-stack operations portal for small businesses — managing products, customers, and sales challans with role-based access control.

## Tech Stack

- **Backend**: Node.js + TypeScript + Express + MySQL
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Auth**: JWT (Bearer tokens)
- **Deployment**: Backend → Render, Frontend → Netlify, DB → Railway/Aiven (MySQL)

---

## Roles

| Role | Access |
|------|--------|
| `admin` | Full access to everything |
| `sales` | Customers (write), challans (create/edit own), products (read) |
| `warehouse` | Products + stock movements (write), challans (confirm/cancel), customers (read) |
| `accounts` | Read-only across all modules |

---

## Local Setup

### Prerequisites
- Node.js 18+
- MySQL 8+

### Backend

```bash
cd backend
npm install

# Copy and fill in your environment variables
cp .env.example .env

# Run DB migrations (creates schema + seeds admin user)
npm run migrate

# Start dev server
npm run dev
```

Backend runs on `http://localhost:5000`

Default admin credentials: `admin@erp.com` / `admin123`

### Frontend

```bash
cd frontend
npm install

# Copy env (points to backend)
cp .env.example .env
# Edit VITE_API_URL if needed

npm run dev
```

Frontend runs on `http://localhost:5173`

---

## Environment Variables

### Backend (`.env`)

```
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=mini_erp
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### Frontend (`.env`)

```
VITE_API_URL=http://localhost:5000
```

---

## Deployment

### Backend → Render (Free Web Service)
- Root dir: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Set all env vars from `.env.example` in Render's dashboard

### Frontend → Netlify (Free)
- Root dir: `frontend`
- Build command: `npm run build`
- Publish directory: `dist`
- Set `VITE_API_URL` to your Render backend URL

### Database → Railway / Aiven / Clever Cloud (MySQL, free tier)
- Create a MySQL database, get the connection string
- Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in Render's env vars
- Run `npm run migrate` once after deploy to create tables

---

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/me` | Current user info |
| GET/POST | `/users` | Admin: list/create users |
| GET/POST/PUT | `/customers` | Customer CRUD |
| POST | `/customers/:id/notes` | Add note to customer |
| GET/POST/PUT | `/products` | Product CRUD |
| POST | `/products/:id/stock-movements` | Manual stock IN/OUT |
| GET/POST/PUT | `/challans` | Challan CRUD |
| POST | `/challans/:id/confirm` | Confirm challan (deducts stock) |
| POST | `/challans/:id/cancel` | Cancel challan |

All list endpoints support `?page=&limit=&search=` pagination.

---

## Key Business Logic

- **Challan confirmation** runs inside a DB transaction: checks stock for every item, rolls back with a specific error message if any item is short, deducts stock and creates movement records on success.
- **Stock never goes negative** — enforced in application logic with descriptive error messages.
- **Product snapshots** — challan items capture name/SKU/price at creation time; historical challans are never affected by product edits.

---

## Known Limitations

- **Render free-tier cold start** — backend spins down after ~15 minutes of inactivity. The first request after idle can take 30–60 seconds. Ping the health endpoint (`/health`) before a live demo.
- **No automated test suite** — correctness verified manually via Postman. The challan stock-deduction logic is isolated in `src/services/challanService.ts` for easy unit testing later.
- **No PDF export / no S3 upload** — bonus items from the spec, not implemented.
- **No Docker / no CI-CD** — deployment done manually via Render/Netlify dashboards.
- **GST number stored but not computed** — stored on customer records; no tax calculation logic.
- **Single currency** — prices displayed in ₹, no multi-currency support.
- **Basic search** — LIKE-based search on list endpoints; no full-text search.
