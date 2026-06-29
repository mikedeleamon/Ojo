# Ojo

**Dress for the weather.** Ojo is a mobile wardrobe assistant that turns the clothes you already own into a daily outfit recommendation, scored against live weather, air quality, and your personal style history.

It pairs an on-device clothing classifier with a multi-factor outfit-scoring engine, then layers on trip planning, wardrobe analytics, and adaptive personalization that sharpens the more you wear.

> 📖 For a deep dive into every feature and where its code lives, see **[FEATURES.md](FEATURES.md)**.

---

## Highlights

- **Smart outfit engine** — every candidate outfit is scored across fabric, color harmony, style/formality, simplicity, and your learned preferences, with a recency penalty that naturally rotates your wardrobe.
- **On-device ML** — a MobileNetV3 TFLite model identifies garments from the camera. Images never leave the phone during classification.
- **Weather intelligence** — temperature, precipitation, wind, AQI, and pollen all feed the recommendation and surface actionable notes.
- **TripFit** — generate a day-by-day outfit plan and packing list for any destination and date range.
- **Wardrobe Insights** — utilization, cost-per-wear, sleeping items, and a donation queue.
- **Personal Style Ranker** — recommendations personalize as you log outfits, with a "style fingerprint" derived from what you actually wear.
- **Accounts** — email/password plus Sign in with Apple and Google, password reset, and a first-run onboarding flow.

---

## Tech stack

| Layer | Technology |
|---|---|
| **App** | React Native 0.81 · Expo SDK 54 · Expo Router · TypeScript |
| **UI** | Liquid glass (`expo-glass-effect`), native iOS tabs, `react-native-svg`, Reanimated |
| **On-device ML** | `react-native-fast-tflite` (MobileNetV3-Small) |
| **Auth** | JWT · `expo-secure-store` · Sign in with Apple · Google Sign-In |
| **Server** | Node · Express · TypeScript · Mongoose (MongoDB) |
| **Weather** | Apple WeatherKit (REST) |
| **Storage** | Cloudflare R2 (wardrobe images) |
| **Email** | Resend (transactional, e.g. password reset) |
| **Push** | Expo Notifications |

---

## Repository structure

```
.
├── app/              Expo Router routes (auth group, native tabs, account stack)
├── src/              App source
│   ├── views/        Screen-level components (LoginPage, OnboardingPage, TripFit, …)
│   ├── components/   Reusable UI (OutfitSuggestion, ClosetView, WeatherHUD, primitives)
│   ├── lib/          Engine + domain logic (outfitEngine, notifications, auth, onboarding)
│   ├── services/     On-device ML (clothingIdentifier)
│   ├── context/      React providers (Auth, Settings, Weather, ActiveLocation)
│   └── theme/        Tokens + ThemeContext
├── server/           Express API (routes, models, lib, middleware)
├── modules/          Local native modules
├── FEATURES.md       Full feature reference
└── R2_MIGRATION.md   Cloudflare R2 image-storage migration notes
```

---

## Getting started

### Prerequisites

- Node 20+
- A MongoDB instance (local or Atlas)
- Xcode (iOS) and/or Android Studio for the native dev client
- Apple Developer credentials for WeatherKit + Sign in with Apple; Google OAuth client IDs for Google Sign-In

### 1. Install dependencies

```bash
npm install            # app
npm install --prefix server   # API server
```

### 2. Configure environment

Copy the example files and fill in the values:

```bash
cp .env.example .env
cp server/.env.example server/.env
```

Key variables:

| Where | Variable | Purpose |
|---|---|---|
| `.env` | `EXPO_PUBLIC_API_URL` | Base URL the app calls (e.g. `http://localhost:4000`) |
| `.env` | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Sign-In (client) |
| `server/.env` | `MONGODB_URI` | MongoDB connection string |
| `server/.env` | `JWT_SECRET` | Long random string for signing tokens |
| `server/.env` | `APPLE_BUNDLE_ID` | Audience for verifying Apple identity tokens |
| `server/.env` | `GOOGLE_IOS_CLIENT_ID` / `GOOGLE_WEB_CLIENT_ID` / `GOOGLE_ANDROID_CLIENT_ID` | Google token verification (server) |
| `server/.env` | `APPLE_WEATHERKIT_*` | Apple WeatherKit REST credentials |
| `server/.env` | `R2_*` | Cloudflare R2 image storage |
| `server/.env` | `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Transactional email (password reset) |

### 3. Run

Run the API and the Expo dev server together:

```bash
npm run dev            # concurrently starts server (cyan) + expo (magenta)
```

Or run them separately:

```bash
npm run dev --prefix server   # API only
npm start                     # Expo only
npm run ios                   # build + launch the iOS dev client
npm run android               # build + launch the Android dev client
```

---

## Authentication & onboarding

Ojo supports three sign-in paths, all of which mint the same JWT and converge on the same authenticated session:

- **Email / password** — `POST /api/auth/signup` and `/login`.
- **Sign in with Apple** — `expo-apple-authentication` → `POST /api/auth/apple` (verifies the identity token, links by `appleSub` or email, or creates a new account).
- **Sign in with Google** — `@react-native-google-signin/google-signin` → `POST /api/auth/google` (mirrors the Apple flow via `googleSub`).

On a **first-time account creation** — whether through the sign-up form or an OAuth sign-in that creates a brand-new user — the app runs its first-run onboarding flow (closet creation, style preferences, notification opt-in). The OAuth endpoints return an `isNewUser` flag that the client uses to mark onboarding pending; returning users and account-linking sign-ins skip straight to the app.

Google Sign-In requires the native module and client IDs to be configured; the button auto-hides until it's available. See the setup notes in `src/lib/googleSignIn.ts`.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run server + Expo together |
| `npm start` | Expo dev server only |
| `npm run ios` / `npm run android` | Build & launch the native dev client |
| `npm test` | Jest test suite |
| `npm run typecheck` | TypeScript `--noEmit` check |
| `npm run clean` / `clean-install` | Reset native build artifacts and dependencies |
| `npm run build --prefix server` | Compile the server to `dist/` |

---

## Documentation

- **[FEATURES.md](FEATURES.md)** — every product feature, how it works, and where the code lives.
- **[R2_MIGRATION.md](R2_MIGRATION.md)** — Cloudflare R2 image-storage migration.
