# E-Commerce Platform — Technical & Business Blueprint

**Initial product:** Clothing · **Future:** multi-category e-commerce platform

This document describes what is built in this repository and how it maps to the original plan.
Status markers: ✅ built · 🔜 next phase.

---

## 1. Architecture

```
                    ┌──────────────────┐
                    │  Customer Web    │  apps/web (Next.js)
                    └────────┬─────────┘
┌──────────────────┐         │         ┌──────────────────┐
│ Android + iOS 🔜 │─────────┼─────────│   Admin Panel    │  apps/admin (Next.js)
│ React Native     │         │         └────────┬─────────┘
└──────────────────┘         ▼                  │
                    ┌──────────────────┐        │
                    │   Backend API    │◄───────┘  apps/api (NestJS)
                    └────────┬─────────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         PostgreSQL        Redis      Object storage
          (Prisma)        (cache)     (local /uploads → S3/R2)
              │
              ▼
   Razorpay · Shipping aggregator webhook · Email (Resend) · Push (FCM 🔜)
```

One API holds **all business logic** — products, inventory, orders, customers, payments and
analytics live in one place. The website, admin panel and (later) the mobile app are thin clients.

### Repository layout

```
apps/
  api/                  NestJS backend
    prisma/             schema.prisma, migrations, seed.ts
    src/
      auth/             customer + admin login, refresh tokens, 2FA
      users/            profile, address book
      catalog/          categories tree, products, variants, inventory, search
      cart/             cart + price quote
      wishlist/
      coupons/          coupon rules + discount math
      orders/           checkout, order state machine, invoice
      payments/         Razorpay gateway, verify, webhook, mock gateway
      shipping/         shipments + aggregator webhook
      returns/          return requests, QC, refunds
      reviews/          verified reviews + moderation
      content/          banners, public settings
      notifications/    in-app + email (+ push/SMS hooks)
      admin/            dashboard, reports, customers, admin users, audit logs
      uploads/          validated image uploads
      common/           config, guards, cache, settings, TOTP, utils
  web/                  Customer website (Next.js App Router)
  admin/                Admin panel (Next.js App Router)
docs/BLUEPRINT.md
docker-compose.yml      PostgreSQL + Redis for local development
.github/workflows/ci.yml
```

## 2. Technology stack

| Part | Technology |
|---|---|
| Website | Next.js 15 + TypeScript + Tailwind ✅ |
| Android / iOS | React Native + Expo 🔜 (uses the same API) |
| Admin panel | Next.js 15 + TypeScript + Tailwind ✅ |
| Backend | Node.js + NestJS 11 ✅ |
| Database / ORM | PostgreSQL 16 + Prisma 6 ✅ |
| Cache | Redis (falls back to in-memory) ✅ |
| Auth | JWT access tokens (15 min) + rotating refresh tokens ✅ |
| Images | Local disk in dev → S3-compatible storage in production |
| Search | PostgreSQL (v1) ✅ → OpenSearch / Elasticsearch later |
| Payments | Razorpay (+ COD) ✅ |
| Shipping | Shiprocket / aggregator via webhook ✅ |
| Notifications | In-app ✅, email via Resend ✅, FCM push 🔜, SMS/WhatsApp 🔜 |
| CI/CD | GitHub Actions ✅ |

## 3. Database design

All money is stored as **integer paise**. Price, stock and SKU live on the **variant**.

```
users ─┬─ addresses
       ├─ carts ── cart_items ── product_variants
       ├─ wishlists ── products
       ├─ orders ─┬─ order_items ── product_variants
       │          ├─ order_status_history
       │          ├─ payments ── refunds
       │          ├─ shipments ── shipment_events
       │          ├─ returns ── return_items ── order_items
       │          └─ coupon_usage ── coupons
       ├─ reviews ── products
       └─ notifications

categories (self-referencing tree) ── product_categories ── products
products ─┬─ product_variants ── inventory (stock movement log)
          └─ product_images (optionally per colour)

admins (role) ── audit_logs        refresh_tokens (users + admins)
banners · settings · webhook_events (idempotency) · daily_counters (order numbers)
```

| Table | Purpose / key fields |
|---|---|
| `users` | name, email, phone, passwordHash (bcrypt), isActive |
| `admins` | role (`SUPER_ADMIN`, `ADMIN`, `PRODUCT_MANAGER`, `ORDER_MANAGER`, `SUPPORT_MANAGER`, `MARKETING_MANAGER`), 2FA secret |
| `refresh_tokens` | SHA-256 hash only, expiry, revokedAt (rotation + reuse detection) |
| `addresses` | name, phone, line1/2, landmark, city, state, pincode, isDefault |
| `categories` | name, slug, parentId (unlimited depth), sortOrder, isActive, isReturnable, returnWindowDays |
| `products` | name, slug, description, brand, material, specifications (JSON), sizeChart (JSON), videoUrl, tags, status (DRAFT/ACTIVE/ARCHIVED), isFeatured, denormalised minPrice / maxMrp / discountPct / rating / soldCount |
| `product_variants` | sku (unique), barcode, color, colorHex, size, price, mrp, stock (available), reserved (held for unpaid orders), isActive |
| `product_images` | url, alt, color, sortOrder |
| `inventory` | every stock change: change, reason (RESTOCK, ADJUSTMENT, ORDER_RESERVED, ORDER_RELEASED, RETURN_RESTOCK), reference, admin |
| `carts`, `cart_items` | one cart per user, quantity per variant |
| `wishlists` | user ↔ product |
| `coupons` | PERCENT/FLAT, value, maxDiscount, minOrderValue, applicable categories, firstOrderOnly, usage & per-user limits, validity |
| `coupon_usage` | coupon, user, order, discount |
| `orders` | orderNumber `ORD-20261006-000123`, status, paymentMethod, paymentStatus, subtotal/discount/shipping/codFee/total, address snapshot |
| `order_items` | product/variant snapshot (name, label, SKU, image, price), quantity, returnedQuantity |
| `payments` | provider (RAZORPAY/COD/MOCK), providerOrderId, providerPaymentId, amount, status |
| `shipments`, `shipment_events` | carrier, AWB, tracking URL, tracking events |
| `returns`, `return_items` | returnNumber `RET-…`, reason, status, refundAmount |
| `refunds` | amount, mode (ORIGINAL / BANK / UPI / STORE_CREDIT), status |
| `reviews` | rating 1–5, verifiedPurchase, isApproved |
| `banners` | HERO / OFFER, schedule |
| `notifications` | type, title, body, channels, readAt |
| `settings` | store settings (shipping fees, COD, return window, pincodes, GSTIN) |
| `audit_logs` | admin, action, entity, data |

### Multi-category from day one

Categories are a tree, products can belong to several categories, and return policy is
configurable per category (inherited by sub-categories). Adding *Home Decor → Bedsheets* or
*Beauty → Skincare* is an admin-panel action — no schema change.

## 4. API reference

Base URL `http://localhost:4000`. 🔒 = customer token, 🛡 = admin token (role in brackets;
SUPER_ADMIN and ADMIN can access every 🛡 route unless marked *super*).

### Auth
| Method | Path | |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | returns `{ user, accessToken, refreshToken }` (rate limited) |
| POST | `/auth/refresh`, `/auth/logout` | rotate / revoke refresh token |
| GET | `/auth/me` 🔒 | |
| POST | `/auth/change-password` 🔒 | revokes all sessions |
| POST | `/admin/auth/login` | `{ email, password, otp? }` → `OTP_REQUIRED` when 2FA is on |
| POST | `/admin/auth/refresh`, `/admin/auth/logout` | |
| GET | `/admin/auth/me` 🛡 | |
| POST | `/admin/auth/2fa/setup`, `/2fa/enable`, `/2fa/disable` 🛡 | TOTP |

### Catalog (public)
| Method | Path | |
|---|---|---|
| GET | `/categories` | tree |
| GET | `/categories/:slug` | with breadcrumbs and children |
| GET | `/products` | `q, category, brand, size, color, minPrice, maxPrice, rating, discount, inStock, featured, sort (newest, price_asc, price_desc, popular, rating, discount), page, limit` → items + facets |
| GET | `/products/suggest?q=` | autocomplete |
| GET | `/products/:slug` | detail, variants, images, reviews, rating breakdown, related, return policy |
| GET | `/serviceability?pincode=` | delivery estimate + COD availability |
| GET | `/products/:productId/reviews` | paginated |
| POST | `/products/:productId/reviews` 🔒 | verified buyers only |
| GET | `/banners?position=HERO\|OFFER`, `/coupons`, `/settings/public` | |

### Customer
| Method | Path | |
|---|---|---|
| PATCH | `/me` 🔒 | name, phone |
| GET/POST/PUT/DELETE | `/me/addresses[/:id]` 🔒 | address book |
| GET | `/cart` 🔒 | items + price summary + stock issues |
| POST | `/cart/items`, PATCH/DELETE `/cart/items/:id` 🔒 | |
| POST | `/cart/merge` 🔒 | merge guest cart after login |
| POST | `/cart/quote` 🔒 | `{ couponCode, paymentMethod, deliveryMethod }` → totals |
| GET | `/wishlist`, `/wishlist/ids`; POST/DELETE `/wishlist/:productId` 🔒 | |
| POST | `/orders` 🔒 | checkout `{ addressId, paymentMethod: COD\|ONLINE, deliveryMethod, couponCode, notes }` → `{ order, payment }` |
| GET | `/orders`, `/orders/:orderNumber` 🔒 | |
| POST | `/orders/:orderNumber/cancel` 🔒 | until PROCESSING |
| POST | `/orders/:orderNumber/pay` 🔒 | retry payment |
| GET | `/orders/:orderNumber/invoice` 🔒 | printable HTML |
| POST | `/orders/track` | public `{ orderNumber, contact }` (email or phone) |
| GET | `/returns`, `/returns/eligibility/:orderNumber`; POST `/returns` 🔒 | |
| GET | `/notifications`; POST `/notifications/:id/read`, `/notifications/read-all` 🔒 | |

### Payments & shipping
| Method | Path | |
|---|---|---|
| POST | `/payments/razorpay/verify` 🔒 | HMAC signature check + payment re-fetched from Razorpay |
| POST | `/payments/razorpay/webhook` | `X-Razorpay-Signature` over raw body, idempotent by event id |
| POST | `/payments/failed` 🔒 | customer closed / failed payment |
| POST | `/payments/mock/complete` 🔒 | dev only (no Razorpay keys, not production) |
| POST | `/shipping/webhook` | header `x-webhook-token`; `{ awb, status, location, note }` |

### Admin
| Method | Path | Roles |
|---|---|---|
| GET | `/admin/dashboard` | all |
| GET | `/admin/reports/sales?from&to` | marketing, order |
| GET/POST/PUT/DELETE | `/admin/categories[/:id]` | product |
| GET/POST/PUT/DELETE | `/admin/products[/:id]`, PATCH `/admin/products/:id/status` | product |
| GET | `/admin/inventory`, `/admin/inventory/:variantId/movements`; POST `/admin/inventory/:variantId/adjust` | product |
| POST | `/admin/uploads` (multipart `file`, JPG/PNG/WEBP ≤ 5 MB, magic-byte checked) | product, marketing |
| GET | `/admin/orders`, `/admin/orders/:id`, `/admin/orders/:id/invoice` | order, support |
| PATCH | `/admin/orders/:id/status` | order |
| POST | `/admin/orders/:id/shipments`, `/admin/orders/:id/refunds/retry` | order |
| GET | `/admin/returns`, `/admin/returns/:id`; PATCH `/admin/returns/:id/status` | order, support |
| GET | `/admin/customers`, `/admin/customers/:id`; PATCH `/admin/customers/:id/status` | support (+ order/marketing read) |
| GET/POST/PUT/DELETE | `/admin/coupons[/:id]`, GET `/admin/coupons/:id/usages` | marketing |
| GET/POST/PUT/DELETE | `/admin/banners[/:id]` | marketing |
| GET/PATCH/DELETE | `/admin/reviews[/:id]` | product, support |
| GET/PUT | `/admin/settings` | all read · admin write |
| GET/POST/PUT | `/admin/admins[/:id]` | *super* |
| GET | `/admin/audit-logs` | *super* |
| GET | `/health` | public |

## 5. Order flow

```
Cart → Address → Delivery method → Coupon → Payment method → POST /orders
                                                              │
     ┌─────────────────────── in one DB transaction ──────────┤
     │ validate cart & stock, apply coupon (atomic usage claim),│
     │ reserve stock (conditional decrement), create order +    │
     │ item snapshots, ORD-YYYYMMDD-NNNNNN, clear cart          │
     └──────────────────────────────────────────────────────────┘
COD    → CONFIRMED immediately
ONLINE → PENDING_PAYMENT → Razorpay order → customer pays → verified → CONFIRMED
                         └ not paid in 30 min → auto-cancelled, stock released

CONFIRMED → PROCESSING → PACKED → SHIPPED → OUT_FOR_DELIVERY → DELIVERED
   (admin)    (admin)    (admin)  (shipment)  (shipping webhook / admin)
Cancel allowed until PACKED (customer until PROCESSING): stock released, coupon restored,
captured payments refunded automatically.
```

Order statuses only move **forward**; invalid transitions are rejected by the API.

## 6. Payment security

The frontend's "success" is never trusted:

1. Backend creates the Razorpay order with the server-side amount.
2. After payment the browser sends `razorpay_order_id | razorpay_payment_id | signature`;
   the API recomputes the HMAC-SHA256 with the key secret **and** re-fetches the payment from
   Razorpay to confirm it is `captured` and belongs to that order.
3. The `payment.captured` webhook (signature over the raw body) confirms it independently, so
   orders are confirmed even if the customer closes the browser.
4. Processing is idempotent (unique provider ids + webhook event table), amounts are compared,
   and a payment that arrives after an order was cancelled is refunded automatically.

## 7. Returns & refunds

```
Customer request (within window, per-category policy)
  → REQUESTED → APPROVED → PICKUP_SCHEDULED → PICKED_UP → RECEIVED
  → QC_PASSED (stock restocked) → REFUNDED
     └ REJECTED / QC_FAILED (quantity becomes returnable again)
```

Reasons: wrong size, wrong product, damaged, defective, not as expected, other.
Refund = item price minus its proportional share of the coupon discount. Online orders are
refunded to the original payment method through Razorpay; COD refunds are recorded as bank /
UPI / store credit payouts.

## 8. Notifications

Order placed, payment successful/failed, confirmed, packed, shipped, out for delivery, delivered,
cancelled, return requested/approved/rejected, refund processed. Every notification is stored
in-app and emailed (Resend when `RESEND_API_KEY` is set, logged otherwise). Push (FCM) and
SMS/WhatsApp have hooks in `NotificationsService` for the mobile phase.

## 9. Security checklist

| Item | Implementation |
|---|---|
| HTTPS | terminate TLS at the load balancer / Vercel; `trust proxy` enabled |
| Password hashing | bcrypt (12 rounds), timing-safe login |
| JWT + refresh tokens | 15-min access tokens, hashed rotating refresh tokens, reuse detection revokes all sessions |
| Role-based admin permissions | `AdminAuthGuard` + `@AdminRoles`, role re-read on every request |
| Admin 2FA | TOTP (RFC 6238), compatible with Google Authenticator / Authy |
| Rate limiting | 120 req/min globally, 10/min on login, register, checkout and tracking |
| Input validation | `class-validator` whitelist + forbid unknown fields on every DTO |
| Secure webhooks | Razorpay HMAC over raw body; shipping webhook shared secret (timing-safe) |
| Image upload validation | size limit + magic-byte detection, random file names |
| Audit logs | every admin write is logged |
| Headers | Helmet on the API; frame / sniff / referrer headers on both Next.js apps |
| Secrets | `.env` files (never committed); production secrets are required at boot |
| Backups & monitoring | use managed PostgreSQL with point-in-time recovery; add Sentry / uptime checks |

## 10. Deployment

- **API**: any Node host (AWS ECS / Fly / Render / a VPS). `npm run build -w apps/api`,
  `npx prisma migrate deploy`, `node dist/main.js`. Serve `uploads/` from S3/R2 in production.
- **Website & admin**: Vercel (or `next build && next start`). Set `API_URL` /
  `NEXT_PUBLIC_API_URL`. Put the admin panel on its own subdomain, ideally behind IP allow-listing.
- **Database**: managed PostgreSQL (AWS RDS, Neon, Supabase). **Cache**: managed Redis (Upstash, ElastiCache).
- **CI**: `.github/workflows/ci.yml` runs migrations, seed, typecheck, unit tests and builds on every PR.

## 11. Development phases

| Phase | Scope | Status |
|---|---|---|
| 1. Foundation | database, backend, auth, admin auth, category & product system | ✅ |
| 2. Customer website | home, categories, listing, detail, search, cart, wishlist, checkout | ✅ |
| 3. Payments & orders | Razorpay, COD, order creation, tracking, invoice, notifications | ✅ (SMS/push 🔜) |
| 4. Mobile apps | React Native + Expo, push notifications, deep links | 🔜 |
| 5. Admin | dashboard, products, inventory, orders, customers, coupons, banners, returns, reports | ✅ |
| 6. Testing & launch | security / payment / load / browser testing, production deployment | partly (unit + e2e flow verified) |

### Recommended next steps

1. Production object storage (S3 / Cloudflare R2) for uploads and a CDN for images.
2. Razorpay live keys, webhook URL and auto-capture; test refunds in Razorpay test mode.
3. Shiprocket integration: create shipments through its API, map its webhook payload in
   `ShippingController`.
4. Mobile app (Expo) reusing every endpoint above; add device-token registration + FCM.
5. OpenSearch when the catalog grows (typo tolerance, synonyms, ranking).
6. Recommendations ("customers also bought") once enough order / view data exists.
