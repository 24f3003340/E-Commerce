# StyleKart — Market Launch Checklist

Website ka code launch ke liye tayyar hai. Neeche woh kaam hain jo **aapko apne accounts mein** karne
hain (inke liye aapki KYC, payment ya domain chahiye). Isi kram mein kariye — har step ke saath likha
hai ki kahan kya daalna hai.

> Saare environment variables: Render → `stylekart-api` → **Environment**, aur Vercel → project →
> **Settings → Environment Variables**. Value badalne ke baad **Redeploy** zaroor karein.

---

## 1. Business aur legal (sabse pehle)

- [ ] **GST registration** (online kapde bechne ke liye zaroori). GSTIN milte hi Admin → Settings → GSTIN mein daaliye.
- [ ] **Current bank account** business ke naam par (Razorpay ke settlements isi mein aayenge).
- [ ] Admin → Settings mein bhariye: *Store name, Registered business name, Registered address,
      Support email, Support phone, WhatsApp number, Seller state*.
- [ ] Policy pages padh lijiye (`/terms`, `/privacy`, `/return-policy`, `/shipping-policy`,
      `/contact`). Ye standard templates hain jo aapke Settings se bharte hain — **ek baar kisi
      lawyer / CA se check karwa lein**.
- [ ] **GST rates confirm karein** (CA se): Admin → Settings → *GST % lower / higher slab* aur
      *Higher slab applies above*. Har product par sahi **HSN code** daalein (T-shirt 6109, shirts
      6105/6205, jeans 6203/6204, footwear 6403/6404 …).

## 2. Apna domain

- [ ] Domain kharidiye (GoDaddy / Hostinger / Cloudflare), jaise `stylekart.in`.
- [ ] Vercel `e-commerce-web` → **Settings → Domains** → `www.stylekart.in` (aur `stylekart.in`) jodiye.
- [ ] Vercel `e-commerce-admin` → Domains → `admin.stylekart.in`.
- [ ] Render `stylekart-api` → **Settings → Custom Domains** → `api.stylekart.in`.
- [ ] DNS records wahi daaliye jo Vercel/Render dikhate hain. HTTPS apne aap lag jaata hai.
- [ ] Domain lagne ke baad variables update kariye:

| Kahan | Variable | Value |
|---|---|---|
| Vercel web | `NEXT_PUBLIC_API_URL`, `API_URL` | `https://api.stylekart.in` |
| Vercel web | `NEXT_PUBLIC_SITE_URL` | `https://www.stylekart.in` |
| Vercel admin | `NEXT_PUBLIC_API_URL` | `https://api.stylekart.in` |
| Vercel admin | `NEXT_PUBLIC_STORE_URL` | `https://www.stylekart.in` |
| Render API | `STOREFRONT_URL` | `https://www.stylekart.in` |
| Render API | `CORS_ORIGINS` | `https://www.stylekart.in,https://stylekart.in,https://admin.stylekart.in` |
| Render API | `PUBLIC_API_URL` | `https://api.stylekart.in` |

## 3. Payment gateway — Razorpay (live)

- [ ] [razorpay.com](https://razorpay.com) par account banaiye, **KYC** (PAN, GST, bank, business
      proof) poora kariye. Website URL mein apna domain daaliye — unki team policy pages aur contact
      details dekhti hai, jo ab website par hain.
- [ ] Activation ke baad **Settings → API Keys → Live key** banaiye. Render mein daaliye:
      `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
- [ ] **Settings → Webhooks → Add**: URL `https://api.stylekart.in/payments/razorpay/webhook`,
      events `payment.captured`, `payment.failed`, `order.paid`, ek secret banaiye aur wahi Render mein
      `RAZORPAY_WEBHOOK_SECRET` mein daaliye.
- [ ] **Payment capture → Automatic** on rakhiye.
- [ ] Render mein **`ALLOW_MOCK_PAYMENTS` = `false`** kariye (test wala "Pay successfully" dialog band).
- [ ] Apne card/UPI se ₹1–₹10 ka ek asli order karke dekhiye, phir use cancel karke refund bhi check kariye.

## 4. Emails — Resend

- [ ] [resend.com](https://resend.com) par account → **Domains → Add** `stylekart.in` → jo DNS records
      (SPF, DKIM) dikhaye woh domain mein daaliye → Verify.
- [ ] API key banaiye. Render mein: `RESEND_API_KEY`, aur `EMAIL_FROM` = `StyleKart <orders@stylekart.in>`.
- [ ] Admin → Settings → **New order alert email** mein apna email daaliye — har naye order ki mail aayegi.
- [ ] Website par "Forgot password" chala kar dekhiye ki email aa raha hai.

## 5. Product photos ka storage — Cloudflare R2

Render ke server par upload ki gayi photos har redeploy par mit jaati hain, isliye R2 zaroori hai
(10 GB tak free).

- [ ] Cloudflare → **R2 → Create bucket** (jaise `stylekart-images`).
- [ ] Bucket → **Settings → Public access**: custom domain `images.stylekart.in` jodiye (ya r2.dev URL on kariye).
- [ ] **R2 → Manage API tokens → Create** (Object Read & Write, sirf is bucket ke liye).
- [ ] Render mein daaliye:
      `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`,
      `S3_BUCKET=stylekart-images`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
      `S3_PUBLIC_URL=https://images.stylekart.in`.
- [ ] Admin mein ek photo upload karke check kariye ki URL `images.stylekart.in/...` wala aa raha hai.

## 6. Hosting ko production plan par

- [ ] Render `stylekart-api` → **Starter plan** (free plan 15 min baad so jaata hai, pehli request 30–60 sec leti hai).
- [ ] Render `stylekart-db` → **paid PostgreSQL** (free database 30 din mein expire hota hai; paid mein daily backups milte hain).
- [ ] Render `stylekart-cache` (Redis) free plan theek hai.
- [ ] [UptimeRobot](https://uptimerobot.com) (free) par `https://api.stylekart.in/health` aur website ka monitor lagaiye — site down hone par SMS/email aayega.

## 7. Shipping — Shiprocket (ya koi aggregator)

- [ ] Shiprocket account + KYC + pickup address.
- [ ] Order aane par: Shiprocket mein shipment banaiye → AWB number Admin → Order → **Create shipment** mein daaliye. Customer ko tracking dikhne lagegi.
- [ ] Shiprocket webhook (tracking updates) URL `https://api.stylekart.in/shipping/webhook`,
      header `x-webhook-token` = Render ka `SHIPPING_WEBHOOK_TOKEN`. (Unka payload format alag ho sakta hai —
      zarurat ho to `apps/api/src/shipping/shipping.controller.ts` mein mapping jodni hogi.)

## 8. Admin aur store ki safai

- [ ] Admin login → Settings → **2FA on kariye** (Google Authenticator).
- [ ] Har team member ka alag admin user banaiye, sahi role ke saath (Admin users page).
- [ ] **Demo data hataiye**: demo products ko *Archived* kariye / delete kariye, demo coupons
      (WELCOME10, FLAT200, FOOTWEAR15) ko apne hisaab se badaliye, demo banners badaliye.
- [ ] Agar live database mein `customer@example.com` demo account hai, to Admin → Customers mein use **Block** kariye.
- [ ] Apne asli products daaliye: har product ki 3–5 asli photos, sahi sizes, stock, MRP/price, HSN code.
- [ ] Banners (1600 × 600) apne design ke daaliye.

## 9. Launch se pehle aakhri test (mobile par bhi)

- [ ] Naya account banana, login, forgot password
- [ ] Product search, filters, size select, pincode check
- [ ] Online payment (UPI + card) aur COD order
- [ ] Coupon lagana
- [ ] Admin se order Packed → Shipped (AWB) → Delivered
- [ ] Return request → approve → refund
- [ ] Invoice download (GST sahi aa raha hai)
- [ ] Emails aa rahe hain (order placed, shipped, refund)

## 10. Launch ke baad marketing

- [ ] [Google Search Console](https://search.google.com/search-console) → domain verify → `https://www.stylekart.in/sitemap.xml` submit.
- [ ] Google Analytics 4 property banaiye → Measurement ID (`G-XXXX`) Vercel web mein `NEXT_PUBLIC_GA_ID`.
- [ ] Google Merchant Center (free listings), Instagram / Facebook shop.
- [ ] Pehle 50 customers ke liye ek launch coupon (Admin → Coupons).

---

### Kya-kya already ban chuka hai

Website, admin panel aur backend ke saare features (catalog, cart, checkout, Razorpay + COD,
orders, shipping tracking, returns/refunds, coupons, reviews, notifications, GST invoices, reports,
role-based admin with 2FA), policy pages, forgot password, order emails, SEO (sitemap, robots,
product structured data), WhatsApp chat button, Redis-down fallback, aur automated tests.

### Baad mein (launch ke baad) kya jod sakte hain

- Android / iOS app (React Native — backend tayyar hai)
- SMS / WhatsApp order updates (MSG91 / Gupshup — DLT registration chahiye)
- Shiprocket API se automatic shipment banana
- Mobile OTP login
- Product reviews mein photos, "frequently bought together"
