# Ojo

> Dress for the weather.

Ojo is a full-stack wardrobe intelligence app. It reads the current weather at your location, scores every possible outfit combination from your closet using a five-factor engine, and surfaces the top three ranked suggestions — getting smarter the more you use it.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript, React Router v6, Axios |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB (via Mongoose) |
| Weather | AccuWeather API (proxied server-side) |
| Styling | CSS Modules, glassmorphism design system |

---

## Prerequisites

- Node.js ≥ 18 (tested on Node 22)
- npm ≥ 8
- MongoDB URI (MongoDB Atlas free tier works)
- [AccuWeather API key](https://developer.accuweather.com/) (free tier works)

---

## Environment setup

The `.env` file in the project root is already configured. At minimum you need:

```
ACCUWEATHER_API_KEY=your_key_here
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=a_long_random_secret
```

All available variables:

| Variable | Required | Description |
|---|---|---|
| `ACCUWEATHER_API_KEY` | Yes | AccuWeather API key |
| `MONGO_URI` | Yes | MongoDB connection URI |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `ACCUWEATHER_BASE_URL` | No | Defaults to AccuWeather's production URL |
| `REACT_APP_USE_MOCK` | No | Set to `true` to skip AccuWeather entirely and use bundled mock data |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (default: `localhost:3000,3001,4000`) |
| `PORT` | No | Server port (default: `4000`) |

---

## Running in development

Two processes run concurrently: Express on port 4000 and the React dev server on port 3000.

```bash
npm install
npm run dev
```

Open **http://localhost:3000**.

> Always use port 3000 in development. CRA's dev server proxies all `/api/*` requests to Express on port 4000, and handles asset serving. Visiting port 4000 directly in dev will break icon and image loading.

**Skipping the AccuWeather API key (mock mode)**

```env
REACT_APP_USE_MOCK=true
```

The app uses bundled mock weather data. All UI, outfit engine, and closet features work normally in mock mode.

---

## Running in production

Everything — React app + API — is served from Express on a single port.

```bash
# 1. Build the React frontend
npm run build

# 2. Compile the TypeScript server
npm run build-server

# 3. Start
npm run start-server
```

Open **http://localhost:4000**.

Or run all three steps together:

```bash
npm run build && npm run server
```

---

## Project structure

```
src/
├── api/              # Axios client setup
├── assets/           # Weather icons, logos
├── components/
│   ├── ArticleModal/ # Add / edit clothing article form
│   ├── ClosetView/   # Closet list + article grid with search & filters
│   ├── OutfitSuggestion/  # Top-3 ranked outfit display
│   ├── WeatherHUD/   # Main weather view (background, forecast strip)
│   ├── WeatherDetails/    # Expandable weather stats
│   └── buttons/      # Nav buttons (Closet, Account, Settings)
├── lib/
│   ├── outfitEngine.ts    # Five-factor scoring engine
│   ├── outfitHistory.ts   # Worn-outfit log (localStorage)
│   └── userPreferences.ts # Preference learning profile (localStorage)
├── views/
│   ├── AccountPage/  # Profile, Preferences, Outfit History, Password tabs
│   ├── ClosetPage/   # Closet management
│   ├── LoginPage/    # Email or username login
│   ├── MainPage/     # App shell
│   ├── OnboardingPage/ # New-user setup wizard
│   ├── SettingsPage/ # Quick settings
│   └── SignupPage/   # Account creation
├── hooks/
│   └── useSettings.ts     # Settings fetch + localStorage cache
└── types.d.ts        # Shared TypeScript interfaces
db/
└── server.ts         # Express API (auth, closets, articles, weather proxy)
models/               # Mongoose schemas (User, Closet, ClothingArticle, Settings)
```

---

## Features

### Weather
- Live weather from device geolocation, with configurable fallback location
- Dynamic full-screen backgrounds that change with weather conditions (sunny, cloudy, rainy, stormy, snow, night)
- 12-hour hourly forecast strip
- Expandable weather detail panel (wind, humidity, UV, feels-like)

### Outfit engine
The engine runs entirely on the server-compiled client bundle — no inference latency.

1. **Hard weather filter** — eliminates climatically impossible items before scoring (e.g. sandals in freezing weather, heavy coats in heat)
2. **Role bucketing** — groups articles into `top`, `bottom`, `fullBody`, `outerwear`, `footwear`, `accessory`; pre-ranks each pool by fabric suitability and caps at 8 candidates per role to bound combination count
3. **Full combination enumeration** — generates every valid cross-role combination (no greedy selection)
4. **Five-factor scorer** — each combination is scored 0–100:

   | Factor | Weight | Signal |
   |---|---|---|
   | Fabric × weather | 30% | 10-cell lookup table per fabric per weather bucket; rain and humidity adjustments |
   | Color harmony | 25% | 12-position RYB color wheel; pairwise scoring (complementary = 1.0, analogous = 0.80, clashing = 0.35) |
   | Style alignment | 25% | Per-style affinity tables for clothing types, categories, fabrics |
   | Simplicity | 10% | Neutral base + one accent = 1.0; penalises busy multi-accent outfits |
   | User preference | 10% | Laplace-smoothed frequency scores from wear history |

5. **Recency penalty** — articles worn in the last 3 days are deprioritised (−0.12 per slot)
6. **Top-3 results** — deduplicated by article fingerprint, sorted by score

### Closet
- Multiple named closets; one can be starred as the preferred closet for outfit suggestions
- Add, edit, and remove clothing articles with type, category, fabric, color, merchant, and image (URL or local file upload)
- Search articles by any field; filter by category, color, and fabric simultaneously
- "Add clothes" button on the outfit card deep-links directly to the preferred closet

### Outfit history & preference learning
- Log worn outfits with one tap ("Wore this today")
- History displayed in Account → History with per-entry timestamps, closet name, and article summary
- Wear frequency feeds a Laplace-smoothed preference model (color 50%, fabric 30%, category 20%) that increases scores for items matching the user's learned style
- Items worn in the last 3 days are automatically deprioritised in new suggestions

### Accounts
- Sign up with first name, last name, email, username, birthday, and password
- Sign in with **email or username**
- JWT authentication (7-day tokens)
- Account management: update profile, change password, adjust preferences
- Delete account — permanently removes the user and all associated closets

### Onboarding
- Four-step animated wizard fires automatically after signup
- Step 1: Welcome, Step 2: Create first closet, Step 3: Style and temperature preferences, Step 4: Done
- Skippable at any point

---

## API routes

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login with email or username |

### User
| Method | Route | Description |
|---|---|---|
| GET | `/api/user/me` | Current user info |
| PUT | `/api/user/profile` | Update username / email |
| PUT | `/api/user/password` | Change password |
| GET | `/api/user/settings` | Load preferences |
| PUT | `/api/user/settings` | Save preferences |
| DELETE | `/api/user/me` | Delete account and all closets |

### Closets
| Method | Route | Description |
|---|---|---|
| GET | `/api/closets` | All closets for the user |
| POST | `/api/closets` | Create closet |
| PUT | `/api/closets/:id` | Rename closet |
| DELETE | `/api/closets/:id` | Delete closet |
| PUT | `/api/closets/:id/preferred` | Set as preferred |
| POST | `/api/closets/:id/articles` | Add article |
| PUT | `/api/closets/:id/articles/:articleId` | Edit article |
| DELETE | `/api/closets/:id/articles/:articleId` | Remove article |

### Weather (proxied)
| Method | Route | Description |
|---|---|---|
| GET | `/api/weather/city` | City lookup by coordinates |
| GET | `/api/weather/current/:cityKey` | Current conditions |
| GET | `/api/weather/forecast/:cityKey` | 12-hour forecast |

---

## How the API proxy works

AccuWeather requests flow server-side so the API key never touches the browser:

```
Browser → Express (/api/weather/*) → AccuWeather (API key appended)
```

In development, CRA's built-in proxy (set via `"proxy": "http://localhost:4000"` in `package.json`) forwards `/api/*` requests from port 3000 to port 4000 automatically.

---

## Troubleshooting

**White screen on refresh at `localhost:4000`**
Run `npm run build` — the server needs a compiled `build/` folder to serve `index.html` for all non-API routes.

**`431 Request Header Fields Too Large`**
Your browser cookies for localhost have grown too large. Clear cookies for `localhost` in DevTools → Application → Cookies.

**Weather shows an error instead of loading**
Check that the Express server is running on port 4000 and that `ACCUWEATHER_API_KEY` is set in `.env`. Use `REACT_APP_USE_MOCK=true` to bypass AccuWeather entirely during development.

**Geolocation blocked / no weather loads**
Set a default city in Account → Preferences → Default location. Ojo falls back to that value when the browser geolocation API is unavailable or denied.
