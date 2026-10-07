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
| Vercel web | `NEXT_PUBLIC_ADMIN_URL` | `https://admin.stylekart.in` (footer ka "Sell on StyleKart" link) |
| Vercel admin | `NEXT_PUBLIC_API_URL` | `https://api.stylekart.in` |
| Vercel admin | `NEXT_PUBLIC_STORE_URL` | `https://www.stylekart.in` |
| Render API | `STOREFRONT_URL` | `https://www.stylekart.in` |
| Render API | `CORS_ORIGINS` | `https://www.stylekart.in,https://stylekart.in,https://admin.stylekart.in` |
| Render API | `PUBLIC_API_URL` | `https://api.stylekart.in` |
| Render API | `ADMIN_URL` | `https://admin.stylekart.in` (seller emails ke links) |

## 3. Payment gateway — Razorpay (live)

> **Abhi website sirf Cash on Delivery par chalti hai.** Checkout mein "Pay online" ke saath
> **Coming soon** dikhta hai. Neeche ki teen Razorpay keys Render mein daalte hi online payment
> (UPI, card, net banking, wallets) **apne aap on ho jayega** — code mein kuch badalna nahi hai.

- [ ] [razorpay.com](https://razorpay.com) par account banaiye, **KYC** (PAN, GST, bank, business
      proof) poora kariye. Website URL mein apna domain daaliye — unki team policy pages aur contact
      details dekhti hai, jo ab website par hain.
- [ ] Activation ke baad **Settings → API Keys → Live key** banaiye. Render mein daaliye:
      `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
- [ ] **Settings → Webhooks → Add**: URL `https://api.stylekart.in/payments/razorpay/webhook`,
      events `payment.captured`, `payment.failed`, `order.paid`, ek secret banaiye aur wahi Render mein
      `RAZORPAY_WEBHOOK_SECRET` mein daaliye.
- [ ] **Payment capture → Automatic** on rakhiye.
- [ ] Keys daalne ke baad Render → **Manual Deploy** kariye, phir website checkout mein "Pay online" chalu dikhna chahiye.
- [ ] Apne card/UPI se ₹1–₹10 ka ek asli order karke dekhiye, phir use cancel karke refund bhi check kariye.

## 4. Emails — Resend

- [ ] [resend.com](https://resend.com) par account → **Domains → Add** `stylekart.in` → jo DNS records
      (SPF, DKIM) dikhaye woh domain mein daaliye → Verify.
- [ ] API key banaiye. Render mein: `RESEND_API_KEY`, aur `EMAIL_FROM` = `StyleKart <orders@stylekart.in>`.
- [ ] Admin → Settings → **New order alert email** mein apna email daaliye — har naye order ki mail aayegi.
- [ ] Website par "Forgot password" chala kar dekhiye ki email aa raha hai.

## 5. Product photos ka storage — Cloudflare R2

Render ke server par upload ki gayi photos har redeploy/restart par mit jaati hain, isliye R2 zaroori hai
(10 GB storage aur downloads free). Code tayyar hai — sirf account aur keys chahiye.

- [ ] [dash.cloudflare.com](https://dash.cloudflare.com) par free account banaiye → left menu **R2 Object Storage**
      → pehli baar *Purchase R2 / Enable* (free plan, card verification maang sakta hai, charge nahi hota).
- [ ] **Create bucket** → naam `stylekart-images`, location *Automatic* → Create.
- [ ] Bucket → **Settings → Public access**:
      - domain ho to **Custom Domains → Connect** `images.stylekart.in` (best, CDN cache ke saath), ya
      - abhi ke liye **R2.dev subdomain → Allow Access** — `https://pub-xxxx.r2.dev` jaisa URL milega.
- [ ] R2 overview page → **Manage R2 API Tokens → Create API token** → permission *Object Read & Write*,
      *Apply to specific bucket* = `stylekart-images` → Create. **Access Key ID** aur **Secret Access Key**
      copy kar lijiye (secret dobara nahi dikhega). Usi page par *S3 endpoint* bhi dikhta hai:
      `https://<account-id>.r2.cloudflarestorage.com`.
- [ ] Render → `stylekart-api` → **Environment** mein daaliye, phir **Save, rebuild and deploy**:

| Variable | Value |
|---|---|
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | `stylekart-images` |
| `S3_ACCESS_KEY_ID` | token ka Access Key ID |
| `S3_SECRET_ACCESS_KEY` | token ka Secret Access Key |
| `S3_PUBLIC_URL` | `https://images.stylekart.in` ya `https://pub-xxxx.r2.dev` (aakhir mein `/` nahi) |

- [ ] Admin → **Settings → Connected services** mein *Product photo storage* "Connected" dikhna chahiye.
      Phir ek product photo upload karke dekhiye ki image URL R2 wala aa raha hai.
- [ ] R2 se pehle upload ki gayi photos (agar koi hon) dobara upload karni hongi.

## 6. Hosting ko production plan par

- [ ] Render `stylekart-api` → **Starter plan** (free plan 15 min baad so jaata hai, pehli request 30–60 sec leti hai).
- [ ] Render `stylekart-db` → **paid PostgreSQL** (free database 30 din mein expire hota hai; paid mein daily backups milte hain).
- [ ] Render `stylekart-cache` (Redis) free plan theek hai.
- [ ] [UptimeRobot](https://uptimerobot.com) (free) par `https://api.stylekart.in/health` aur website ka monitor lagaiye — site down hone par SMS/email aayega.

## 7. Courier — Shiprocket

Website Shiprocket se judi hai: order page par **Book courier** dabate hi Shiprocket order banta hai,
sabse sasta/recommended courier chunkar **AWB** milta hai, **pickup** schedule hota hai aur **label**
download ho jaata hai. Courier ke scan hote hi order apne aap *Shipped → Out for delivery → Delivered*
hota hai (COD ka payment bhi Delivered par "Paid" ho jaata hai). Seller apne panel se khud book kar
sakte hain — pickup unke apne address se hota hai.

- [ ] [shiprocket.in](https://www.shiprocket.in) par account + **KYC** (PAN/GST, bank). Wallet mein kuch
      balance daaliye (shipping charge wahi se katta hai). **COD remittance** ke liye bank account verify kariye —
      COD ka paisa Shiprocket aapke account mein bhejta hai.
- [ ] **Settings → Pickup Addresses** → apna godown/dukaan address jodiye, nickname **`Primary`** rakhiye
      (ya jo rakhein wahi Render mein `SHIPROCKET_PICKUP_LOCATION` mein daaliye). Phone OTP se verify kariye.
- [ ] **Settings → API → Configure → Create an API User** → ek *alag* email (jaise `api@stylekart.in`) aur
      password. Main login mat use kariye.
- [ ] Render → Environment: `SHIPROCKET_EMAIL` = API user ka email, `SHIPROCKET_PASSWORD` = uska password.
- [ ] **Settings → API → Webhooks** (tracking): URL `https://api.stylekart.in/shipping/courier-updates`
      (abhi `https://stylekart-api.onrender.com/shipping/courier-updates`), **Token** mein Render ka
      `SHIPROCKET_WEBHOOK_TOKEN` value copy-paste kariye → Save / Test.
- [ ] Save + redeploy ke baad Admin → Settings → Connected services mein *Courier (Shiprocket)* "Connected".
- [ ] **Marketplace sellers**: seller pehli baar "Book courier pickup" dabata hai to uska pickup address
      Shiprocket mein `SK-<store-name>` naam se apne aap jud jaata hai. **Shiprocket naye pickup address ko
      OTP se verify karwata hai** — Shiprocket dashboard → Pickup Addresses mein us address ko verify kar
      dijiye (ya seller ke phone par aaya OTP daaliye), warna us seller ki booking fail hogi.
- [ ] Ek test order par **Book courier** → label print → courier pickup → tracking update check kariye.
- [ ] Order cancel karne par Shiprocket booking bhi apne aap cancel hoti hai. Agar kabhi error aaye to
      Shiprocket dashboard se manually cancel kar dijiye.
- [ ] Bina Shiprocket ke bhi kaam chalta hai: "Shipped another way? Enter AWB" se courier ka naam aur AWB
      haath se daal sakte hain.

## 8. Marketplace — bahar ke sellers

Sellers **`https://admin.stylekart.in/seller/register`** par khud register karte hain (website footer
mein "Sell on StyleKart" link hai). Wahan woh GSTIN, PAN, pickup address aur bank / UPI details
bharte hain.

- [ ] Admin → Settings → **Marketplace sellers**: default commission % (jaise 10%), *Seller products
      need approval* on rakhiye, *Payout hold* return window se zyada rakhiye (jaise 10 din).
- [ ] Naya seller aane par order-alert email par mail aati hai. Admin → **Sellers** → seller kholiye →
      GSTIN / PAN / bank verify kariye → **Approve seller**. (Kisi seller ka commission alag rakhna ho
      to wahin set kariye.)
- [ ] Seller ke products Admin → Products → **Waiting for approval** mein aate hain → photo, title,
      category, price check karke **Approve** ya reason ke saath **Reject**.
- [ ] Ek cart mein alag-alag sellers ke items ho to **har seller ka alag order** banta hai. Seller apne
      panel mein order accept → packed → **AWB daal kar shipped** karta hai. Delivered courier webhook
      ya Admin se mark hota hai (COD ka cash aapke courier account mein aata hai).
- [ ] **Payout**: delivery + hold period ke baad seller ki kamai (item value − commission) "Ready for
      payout" mein aati hai. Seller ke bank / UPI mein transfer kariye, phir Admin → Sellers → seller →
      **Record payout** mein UTR daaliye. Seller ko email jaati hai.
- [ ] **CA se zaroor poochiye**: marketplace (e-commerce operator) ko GST ke under **TCS (Section 52)**
      aur Income Tax **TDS (194-O)** kaatna aur file karna padta hai, aur commission par GST invoice
      dena hota hai. Ye abhi app mein automatic nahi hai — payout ke waqt CA ke hisaab se amount kaatiye.
- [ ] Ek **seller agreement** (commission, returns, payout timing, fake product par penalty) lawyer se
      banwa kar sellers ke saath share kariye.

## 9. Admin aur store ki safai

- [ ] Admin login → Settings → **2FA on kariye** (Google Authenticator).
- [ ] Har team member ka alag admin user banaiye, sahi role ke saath (Admin users page).
- [ ] **Demo data hataiye**: demo products ko *Archived* kariye / delete kariye, demo coupons
      (WELCOME10, FLAT200, FOOTWEAR15) ko apne hisaab se badaliye, demo banners badaliye.
- [ ] Agar live database mein `customer@example.com` demo account hai, to Admin → Customers mein use **Block** kariye.
- [ ] Apne asli products daaliye: har product ki 3–5 asli photos, sahi sizes, stock, MRP/price, HSN code.
- [ ] Banners (1600 × 600) apne design ke daaliye.

## 10. Launch se pehle aakhri test (mobile par bhi)

- [ ] Naya account banana, login, forgot password
- [ ] Product search, filters, size select, pincode check
- [ ] COD order (aur Razorpay keys ke baad online payment — UPI + card)
- [ ] Test seller register → approve → product approve → us product ka COD order → seller panel se ship → payout
- [ ] Coupon lagana
- [ ] Admin se order Packed → Shipped (AWB) → Delivered
- [ ] Return request → approve → refund
- [ ] Invoice download (GST sahi aa raha hai)
- [ ] Emails aa rahe hain (order placed, shipped, refund)

## 11. Launch ke baad marketing

- [ ] [Google Search Console](https://search.google.com/search-console) → domain verify → `https://www.stylekart.in/sitemap.xml` submit.
- [ ] Google Analytics 4 property banaiye → Measurement ID (`G-XXXX`) Vercel web mein `NEXT_PUBLIC_GA_ID`.
- [ ] Google Merchant Center (free listings), Instagram / Facebook shop.
- [ ] Pehle 50 customers ke liye ek launch coupon (Admin → Coupons).

---

### Kya-kya already ban chuka hai

Multi-seller marketplace (seller sign-up + approval, seller panel, per-seller orders, commission,
payouts), Cash on Delivery checkout (online payment Razorpay keys aate hi on),
website, admin panel aur backend ke saare features (catalog, cart, checkout, Razorpay + COD,
orders, shipping tracking, returns/refunds, coupons, reviews, notifications, GST invoices, reports,
role-based admin with 2FA), policy pages, forgot password, order emails, SEO (sitemap, robots,
product structured data), WhatsApp chat button, Redis-down fallback, aur automated tests.

### Baad mein (launch ke baad) kya jod sakte hain

- Android / iOS app (React Native — backend tayyar hai)
- SMS / WhatsApp order updates (MSG91 / Gupshup — DLT registration chahiye)
- Shiprocket API se automatic shipment banana
- Mobile OTP login
- Product reviews mein photos, "frequently bought together"
