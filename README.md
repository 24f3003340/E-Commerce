# StyleKart — Multi-category E-Commerce Platform

Clothing se shuru hone wala **multi-seller marketplace** (Meesho / Flipkart jaisa): bahar ke sellers
khud register karke apne products bechte hain, aur aapki apni dukaan ke products bhi saath mein
chalte hain. Ek central backend API saare clients ko serve karta hai:

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
| Admin panel + Seller panel (`/seller`) | `apps/admin` | 3001 | Next.js 15, React 19, Tailwind CSS |

Full technical blueprint (architecture, database, API list, flows, security, roadmap):
**[docs/BLUEPRINT.md](docs/BLUEPRINT.md)**

**Going live?** Follow the step-by-step launch checklist: **[docs/LAUNCH.md](docs/LAUNCH.md)**

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

### Marketplace sellers

- Sellers sign up at **http://localhost:3001/seller/register** (linked from the website footer as
  "Sell on StyleKart") with GSTIN, PAN, pickup address and bank / UPI details.
- Admin → **Sellers** approves / rejects / suspends them and sets a per-seller commission (default
  in Admin → Settings → Marketplace). Seller products go to **Products → Waiting for approval**.
- A cart with items from several sellers becomes **one order per seller**; each seller sees and
  ships only their own orders and gets a GST invoice in their name.
- Seller earnings = item value − commission, released after delivery + the payout hold period.
  Admin → Sellers → *Record payout* (after the bank / UPI transfer) settles them.

### Payments in development

Checkout is **cash on delivery only** in production until Razorpay keys are set — the website
shows "Pay online — coming soon". In development, without Razorpay keys the API runs a **mock
gateway**: checkout shows a test dialog with "Pay successfully" / "Fail payment". Add
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and
`RAZORPAY_WEBHOOK_SECRET` to `apps/api/.env` to switch to real Razorpay Checkout
(UPI, cards, net banking, wallets). Point the Razorpay webhook to
`POST /payments/razorpay/webhook` with events `payment.captured`, `payment.failed`, `order.paid`,
and enable auto-capture.

## Deploy (Render + Vercel, free tiers)

The backend, database and Redis go on **Render** (one Blueprint), the website and admin panel
on **Vercel** (two projects from the same repo).

### 1. Backend on Render

1. Sign in to [render.com](https://render.com) with GitHub → **New → Blueprint** → pick this
   repository and branch. Render reads [`render.yaml`](render.yaml) and creates
   `stylekart-api` (Node web service), `stylekart-db` (PostgreSQL) and `stylekart-cache` (Redis).
2. Click **Apply**. The first deploy installs, builds, runs migrations and seeds the demo catalog.
3. Copy the API URL, e.g. `https://stylekart-api.onrender.com`, and open `/health` on it.
4. Admin password: Render → `stylekart-api` → **Environment** → `SEED_ADMIN_PASSWORD`
   (generated). Email is `admin@example.com`.

### 2. Website and admin panel on Vercel

Create **two** projects at [vercel.com/new](https://vercel.com/new), both importing this repo:

| Project | Root Directory | Environment variables |
|---|---|---|
| `stylekart-web` | `apps/web` | `NEXT_PUBLIC_API_URL` = Render API URL, `API_URL` = Render API URL, `NEXT_PUBLIC_ADMIN_URL` = admin app URL |
| `stylekart-admin` | `apps/admin` | `NEXT_PUBLIC_API_URL` = Render API URL, `NEXT_PUBLIC_STORE_URL` = website URL |

Framework, install and build commands come from each app's `vercel.json`.

### 3. Notes for the free tiers

- The Render free web service sleeps after ~15 minutes idle; the first request then takes
  ~30–60 s. Free PostgreSQL databases expire after 30 days — upgrade before real launch.
- `CORS_ORIGINS` defaults to `https://*.vercel.app`; set your exact domains once you add a
  custom domain.
- Checkout is cash on delivery only until the `RAZORPAY_*` keys are added in Render; online
  payment then turns on automatically (the mock payment dialog never runs in production).
- Set `ADMIN_URL` (Render) and `NEXT_PUBLIC_ADMIN_URL` (Vercel web) to the admin app URL so seller
  emails and the "Sell on StyleKart" footer link point to the seller panel.
- Admin-uploaded images are stored on the service disk, which is wiped on every redeploy on
  Render — move uploads to S3 / Cloudflare R2 before adding real products. The demo artwork
  lives in `apps/api/assets` and is safe.

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

**Seller panel** (`/seller` in the admin app) — seller sign-up with GST / PAN / bank details,
dashboard, products (same editor, sent for approval), inventory, own orders (accept → pack → ship
with AWB → invoice / packing slip, cancel), earnings & payout history, profile.

**Backend** — marketplace (sellers, approval, per-seller orders, commission, payouts), JWT access + rotating refresh tokens, role-based admin permissions, rate limiting,
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
