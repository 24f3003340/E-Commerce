# StyleKart mobile app (Android + iOS)

`apps/mobile` — ek hi code se **Android aur iOS dono** apps banti hain (Expo / React Native). App wahi
backend API use karti hai jo website use karti hai, isliye products, orders, stock, sellers, coupons sab
ek jagah se chalte hain — admin panel mein jo badlo, app mein turant dikhega.

## App mein kya hai

| Screen | Kya karta hai |
|---|---|
| Home | Banners, categories, Featured / Trending / New arrivals |
| Categories | Category tree → product list |
| Search | Live suggestions (products + categories) |
| Product list | Infinite scroll, sort, size / colour / brand filters |
| Product page | Photos, colour + size, stock alert, pincode delivery check, reviews, related products |
| Bag | Quantity change, remove, stock issues, free-delivery nudge |
| Checkout | Address chuno / naya jodo, Standard / Express, coupon, **Cash on delivery** |
| Orders | List, tracking timeline, courier tracking link, cancel, return request, rate & review |
| Account | Addresses, notifications, returns, policy pages, logout, **Delete my account** |

Login tokens phone ke secure storage (iOS Keychain / Android Keystore) mein rehte hain.

**Online payment (UPI / card)**: app abhi sirf COD leti hai. Razorpay keys lagne ke baad website par online
payment chalu ho jaata hai; app mein Razorpay ka native SDK jodna agla step hai (`react-native-razorpay`
+ development build).

## Apne computer par chalana

```bash
# backend pehle chalu ho (README ka Quick start)
cd apps/mobile
npm install
cp .env.example .env      # EXPO_PUBLIC_API_URL set kariye
npx expo start
```

- Phone par **Expo Go** app install karke QR code scan kariye. Phone aur computer ek hi Wi-Fi par hon, aur
  `.env` mein `EXPO_PUBLIC_API_URL=http://<computer-ka-LAN-IP>:4000` ho (`localhost` phone par kaam nahi karta).
- Android emulator: `http://10.0.2.2:4000`. iOS simulator (sirf Mac): `http://localhost:4000`.
- `npm run typecheck` — TypeScript check. CI har push par typecheck + Android/iOS bundle banata hai.

## Store par launch — checklist

### 1. Accounts (ek baar)

- [ ] **Expo** account: [expo.dev](https://expo.dev) (free). Builds Expo ke cloud par bante hain — Mac ya
      Android Studio ki zarurat nahi.
- [ ] **Google Play Console**: [play.google.com/console](https://play.google.com/console) — **$25 ek baar**.
      Naye personal accounts ko production se pehle **12 testers ke saath 14 din closed testing** karni padti hai;
      organisation (company) account mein yeh shart nahi hai — GST / D-U-N-S number ho to company account banaiye.
- [ ] **Apple Developer Program**: [developer.apple.com/programs](https://developer.apple.com/programs) — **$99 / saal**.
      Company ke naam se chahiye to D-U-N-S number lagta hai.

### 2. App ki pehchaan set kariye

`apps/mobile/app.json`:
- `name` — store par dikhne wala naam
- `ios.bundleIdentifier` aur `android.package` — abhi `com.stylekart.app`. **Pehli upload ke baad yeh
  kabhi nahi badal sakta**, isliye apne domain ke hisaab se final kar lijiye (jaise `in.stylekart.app`).
- `assets/icon.png` (1024×1024), `assets/android-icon-*.png`, `assets/splash-icon.png` — abhi Expo ke
  default icons hain, **apne logo se badaliye**.

`apps/mobile/eas.json` → `production.env`:
- `EXPO_PUBLIC_API_URL` = live API (`https://api.stylekart.in` ya `https://stylekart-api.onrender.com`)
- `EXPO_PUBLIC_WEB_URL` = live website (privacy / terms / password reset links ke liye)

> API ka CORS mobile app par lagu nahi hota — Render mein kuch badalne ki zarurat nahi.

### 3. Build

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init                                  # project ko Expo account se jodta hai
npx eas-cli@latest build --platform android --profile preview     # test APK — WhatsApp par bhej ke try kariye
npx eas-cli@latest build --platform all --profile production      # store wale builds (.aab + .ipa)
```

Signing keys (Android keystore, Apple certificates) EAS khud bana ke sambhalta hai — puchhe to "Yes" kariye.

### 4. Google Play Store

- [ ] Play Console → **Create app** → naam, Free, App.
- [ ] **Store listing**: short + full description, 512×512 icon, 1024×500 feature graphic, kam se kam 2 phone screenshots.
- [ ] **App content**: Privacy policy URL (`https://www.stylekart.in/privacy`), Ads = No, **Data safety** form
      (Name, Email, Phone, Address, Purchase history collect hote hain; encrypted in transit; user delete kar sakta hai),
      Target audience 18+, Content rating questionnaire.
- [ ] **Account deletion URL** maangega — app mein *Account → Delete my account* hai; web URL ke liye
      `https://www.stylekart.in/contact` de sakte hain.
- [ ] `npx eas-cli@latest submit --platform android` (pehli baar Google Cloud service-account JSON key maangega —
      EAS ka link follow kariye) → Internal testing → Closed testing → Production.

### 5. Apple App Store

- [ ] `npx eas-cli@latest submit --platform ios` — App Store Connect mein app record khud ban jaata hai.
- [ ] App Store Connect → **App Privacy** (Play wale Data safety jaisa), Privacy policy URL, Support URL,
      screenshots (6.7" aur 6.5" iPhone), description, keywords, category *Shopping*.
- [ ] **Review notes** mein ek **test login** dijiye (email + password) — Apple reviewer bina login ke
      checkout check nahi kar payega, aur aisa na hone par app reject hoti hai.
- [ ] Account deletion app ke andar hai (Guideline 5.1.1(v)) ✔. COD physical goods ke liye Apple In-App
      Purchase ki zarurat nahi ✔.

### 6. Updates

- Sirf JS / screen changes: `npx eas-cli@latest update` (EAS Update) se bina store review ke bhej sakte hain
  (pehle `npx expo install expo-updates` aur ek naya build).
- Native change (naya native package, icon, permissions): `app.json` mein `version` badhaiye → naya
  `eas build` → `eas submit`. `buildNumber` / `versionCode` EAS khud badhata hai (`autoIncrement`).
