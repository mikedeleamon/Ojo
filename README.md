# Ojo

> Dress for the weather.

A weather app that tells you what to wear based on current conditions and your personal style preferences.

## Stack

- React 18 + TypeScript
- Express + Node.js (API proxy server)
- React Router v6
- Axios
- AccuWeather API
- MongoDB (optional — for user accounts and saved settings)

---

## Prerequisites

- Node.js ≥ 16
- npm ≥ 8
- An [AccuWeather API key](https://developer.accuweather.com/) (free tier works)

---

## Environment setup

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```
ACCUWEATHER_API_KEY=your_key_here
```

All other variables are optional — see `.env.example` for the full list and descriptions. The app will run without MongoDB; user settings just won't persist between sessions.

---

## Running in development

Development mode runs two processes concurrently: the Express server on port 4000 and the React dev server on port 3000.

```bash
npm install
npm run dev
```

Then open **http://localhost:3000** in your browser.

> **Important:** always use port 3000 in development. The React dev server handles all asset requests (JS bundles, images, fonts) and proxies API calls to Express on port 4000 automatically. Visiting port 4000 directly in dev will break icon and asset loading.

If you see a `431 Request Header Fields Too Large` error, your browser cookies for localhost have grown too large. Fix it by clearing cookies for `localhost` in DevTools → Application → Cookies, or set `REACT_APP_SERVER_BASE=http://localhost:4000` in `.env` to bypass the proxy.

### Skipping the API key (mock mode)

To develop without an AccuWeather API key, add this to your `.env`:

```
REACT_APP_USE_MOCK=true
```

The app will use bundled mock data and all icons and UI will render normally.

---

## Running in production

The production setup builds the React app into static files, then serves everything — the React app and the API — from Express on a single port.

**Step 1 — Build the React app:**

```bash
npm run build
```

This produces a `build/` directory containing `index.html` and all compiled assets (JS bundles, hashed image files, etc.).

**Step 2 — Build the Express server:**

```bash
npm run build-server
```

This compiles the TypeScript server from `db/server.ts` into `dist-server/`.

**Step 3 — Start the server:**

```bash
npm run start-server
```

Then open **http://localhost:4000** in your browser.

The Express server serves the React build's static files (including `/static/media/` where webpack places the compiled weather icons) and falls back to `index.html` for all non-API routes so React Router works correctly.

> **Why icons 404 if you skip step 1:** The weather icons live in `src/assets/images/weatherIcons/` during development, but webpack copies and renames them into `build/static/media/` with a content hash during the build. The compiled app references those hashed paths. If `build/` is missing or stale, Express has no files to serve and the browser gets a 404.

Or run steps 1–3 together:

```bash
npm run build && npm run server
```

---

## How the API proxy works

API calls never go directly from the browser to AccuWeather. The flow is:

```
Browser → Express (/api/weather/*) → AccuWeather (with API key appended server-side)
```

This keeps the API key out of the browser entirely. In development, CRA's built-in proxy (configured via `"proxy": "http://localhost:4000"` in `package.json`) forwards `/api/*` requests from port 3000 to Express on port 4000.

---

## Features

- Live weather from your current location (geolocation API)
- 12-hour hourly forecast strip
- Outfit recommendations based on temperature, humidity, and precipitation
- Style preferences (Casual, Business Casual, Urban, Cozy, Preppy, Formal)
- Dynamic backgrounds that change with weather conditions
- Dark-first glassmorphism UI
