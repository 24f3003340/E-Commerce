# StyleKart — Multi-category E-Commerce Platform

Clothing se shuru hone wala, lekin **multi-category marketplace tak grow** karne ke liye bana hua
full e-commerce platform. Ek central backend API teeno clients ko serve karta hai:

```
              Backend API (NestJS)
             /        |         \
   Customer Website  Mobile App   Admin Panel
     (Next.js)     (React Native,   (Next.js)
                    phase 4)
                       |
        PostgreSQL · Redis · Object storage · Razorpay · Shipping · Notifications
```

| App | Path | Port | Stack |
|---|---|---|---|
| Backend API | `apps/api` | 4000 | NestJS 11, Prisma 6, PostgreSQL, Redis |
| Customer website | `apps/web` | 3000 | Next.js 15, React 19, Tailwind CSS |
| Admin panel | `apps/admin` | 3001 | Next.js 15, React 19, Tailwind CSS |

Full technical blueprint (architecture, database, API list, flows, security, roadmap):
**[docs/BLUEPRINT.md](docs/BLUEPRINT.md)**

## Quick start (local)

Requirements: Node.js 20+, Docker (or a local PostgreSQL 16 + Redis 7).

```bash
# 1. Database + cache
docker compose up -d

# 2. Install all workspaces
npm install

# 3. Environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local

# 4. Create tables + demo data (categories, 17 products, coupons, banners, admin)
npm run db:migrate
npm run db:seed

# 5. Run everything (three terminals)
npm run dev:api     # http://localhost:4000
npm run dev:web     # http://localhost:3000
npm run dev:admin   # http://localhost:3001
```

### Demo logins

| Where | Email | Password |
|---|---|---|
| Website (customer) | customer@example.com | Customer@123 |
| Admin panel (super admin) | admin@example.com | Admin@12345 |

Demo coupons: `WELCOME10` (first order), `FLAT200` (orders ≥ ₹1,499), `FOOTWEAR15` (footwear only).

### Payments in development

Without Razorpay keys the API runs a **mock gateway**: checkout shows a test dialog with
"Pay successfully" / "Fail payment". Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and
`RAZORPAY_WEBHOOK_SECRET` to `apps/api/.env` to switch to real Razorpay Checkout
(UPI, cards, net banking, wallets). Point the Razorpay webhook to
`POST /payments/razorpay/webhook` with events `payment.captured`, `payment.failed`, `order.paid`,
and enable auto-capture.

## What's included

**Customer website** — home with banners & categories, category tree navigation, listing with
size / colour / price / brand / rating / discount / availability filters and sorting, search with
suggestions, product page with colour × size variants, size chart, pincode delivery estimate,
wishlist, guest cart (merged on login), checkout (address book, standard/express delivery,
coupons, online payment or COD), order tracking (logged-in and public by order ID), cancellation,
printable invoice, returns, reviews (verified buyers) and notifications.

**Admin panel** — dashboard, orders (status workflow, shipments, invoices, refunds), returns
(approve → pickup → QC → refund), products with variant generator & image upload, categories
(unlimited nesting, per-category return policy), inventory with stock history, customers,
coupons with rules, banners, review moderation, sales reports with CSV export, settings,
admin users with roles, TOTP two-factor login, audit logs.

**Backend** — JWT access + rotating refresh tokens, role-based admin permissions, rate limiting,
input validation, atomic stock reservation, Razorpay signature + webhook verification
(idempotent), shipping aggregator webhook, auto-expiry of unpaid orders, notifications
(in-app + email via Resend; push/SMS hooks), Redis caching, audit logs.

## Useful commands

```bash
npm run typecheck          # all workspaces
npm test                   # API unit tests
npm run build              # production builds
npm run db:migrate         # create/apply migrations (dev)
npm run prisma:deploy -w apps/api   # apply migrations in production
```

All money values in the database and API are **integer paise** (₹1 = 100).
