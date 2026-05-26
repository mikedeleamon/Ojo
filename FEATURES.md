# Ojo — Feature Reference

This document describes every product feature built into Ojo, how it works under the hood, and where the relevant code lives. Features are grouped by the roadmap tier they belong to.

---

## Table of Contents

- [Core Architecture](#core-architecture)
- [Tier 1 — Surfaced Intelligence](#tier-1--surfaced-intelligence)
  - [Occasion Quick-Switch](#1-occasion-quick-switch)
  - [Wardrobe Gap Card](#2-wardrobe-gap-card)
  - [Outfit History Screen](#3-outfit-history-screen)
  - [Wear Pattern Visualizer](#4-wear-pattern-visualizer)
- [Tier 2 — New Capabilities](#tier-2--new-capabilities)
  - [AQI / Pollen Intelligence Layer](#5-aqi--pollen-intelligence-layer)
  - [Wardrobe Health Heat Map](#6-wardrobe-health-heat-map)
  - [Outfit History Server Sync](#7-outfit-history-server-sync)
  - [TripFit — Trip Planner](#8-tripfit--trip-planner)
- [Tier 3 — Differentiation Layer](#tier-3--differentiation-layer)
  - [Personal Style Ranker](#9-personal-style-ranker)
  - [Outfit Sharing Cards](#10-outfit-sharing-cards)
  - [Scan Outfit — Vision Capture](#11-scan-outfit--vision-capture)

---

## Core Architecture

Before the features, the engine underneath them:

**Outfit Engine** (`src/lib/outfitEngine.ts`)  
Multi-factor scoring pipeline. Every outfit candidate is scored across five dimensions:

| Factor | What it measures |
|---|---|
| **Fabric** | How appropriate each fabric is for the current weather bucket (hot / warm / cool / cold / freezing), accounting for precipitation intensity, humidity, and wind |
| **Color** | Harmony of the outfit's color palette using a wheel-based algorithm (complementary, analogous, triadic) and a neutral-override rule |
| **Style** | Fit between each garment's formality and the user's selected clothing style (Casual → Formal) |
| **Simplicity** | Penalty for over-accessorizing or mixing too many competing style signals |
| **Preference** | How closely the outfit matches the user's historical color, fabric, and category patterns (see [Personal Style Ranker](#9-personal-style-ranker)) |

A recency penalty nudges the engine away from items worn in the past 3–7 days, rotating the wardrobe naturally. Scores are normalized to 0–100 and boosted by layering confidence (up to +3 points).

**On-Device ML** (`src/services/clothingIdentifier.ts`)  
MobileNetV3-Small trained on Fashionpedia (34 garment classes + sleeve length). Runs entirely on-device via `react-native-fast-tflite` — no images ever leave the phone during classification.

---

## Tier 1 — Surfaced Intelligence

These features activate capabilities already built into the engine. They required very little new logic — the value was exposing existing intelligence as interactive UI.

---

### 1. Occasion Quick-Switch

**What it does**  
A horizontally scrollable row of chips pinned above the outfit pager on the home screen. Tapping a chip instantly re-generates outfit suggestions for that occasion without touching Settings.

**Chips:** Everyday · Work · Weekend · Date · Outdoor · Athletic

**How it works**  
The outfit engine has always had a full `OCCASION_TARGETS` formality scoring table — one target formality score per occasion per clothing type. Before this feature, the occasion was buried in Settings and changed rarely. The chip row creates an ephemeral `occasionOverride` state that shadows `settings.occasion` only for the current session.

When a chip is selected:
1. `occasionOverride` updates in component state.
2. `effectiveSettings` (a `useMemo`) merges the override into the real settings.
3. `generateOutfits` re-runs with the merged settings — the `occasionScore` component of each combo's score shifts, re-ranking the results.

No settings are persisted. Switching tabs or refreshing returns to the saved occasion preference.

**Key files**
- `src/components/OutfitSuggestion/OutfitSuggestion.tsx` — `OccasionChips` component, `occasionOverride` state, `effectiveSettings` memo
- `src/lib/outfitEngine.ts` — `occasionScore()`, `OCCASION_TARGETS`

---

### 2. Wardrobe Gap Card

**What it does**  
A dismissable amber glass card that appears below the outfit pager when the engine detects a recurring wardrobe gap — an item type it keeps recommending but the user doesn't own. The card names the gap, explains why it matters, and offers a "Browse [item]" CTA that opens a product search.

**How it works**  
The gap detector (`src/lib/wardrobeGaps.ts`) watches the freetext notes that `buildNotes()` generates for every outfit. Each note is scanned for known gap signals (e.g., "consider adding a waterproof layer"). When the same gap signal fires 4 or more times within 30 days, `getGapSuggestions()` surfaces it.

Every time `OutfitSuggestion` renders an active outfit, it calls `recordGapsFromNotes(activeOutfit.notes)` in a `useEffect`. The card is shown if a gap suggestion is present and the user hasn't dismissed it this session. The "Browse" button constructs a merchant search URL from `GAP_SEARCH_TERMS` and opens it via `Linking.openURL`.

**Gap types detected**

| Gap ID | Trigger | Search term |
|---|---|---|
| `missing_coat` | Winter conditions, no coat | "winter coat" |
| `missing_jacket` | Cool weather, no layer | "light jacket" |
| `missing_boots` | Cold + wet, no boots | "boots" |
| `missing_mid_layer` | Cool conditions, no hoodie/sweater | "hoodie sweater" |
| `missing_rain_layer` | Rain forecast, no waterproof layer | "waterproof jacket" |
| `missing_footwear` | No footwear in closet at all | "shoes" |

**Key files**
- `src/lib/wardrobeGaps.ts` — `recordGapsFromNotes()`, `getGapSuggestions()`
- `src/components/OutfitSuggestion/OutfitSuggestion.tsx` — `GapCard` sub-component, gap recording effect
- `src/components/OutfitSuggestion/OutfitSuggestion.styles.ts` — amber glass card styles

---

### 3. Outfit History Screen

**What it does**  
A full scrollable timeline of every outfit the user has logged ("Wore this today"), with the date, closet name, and a plain-text article summary for each entry. Accessible from the Style tab and from the Account → History screen.

**How it works**  
Every time the user taps "Wore this today" in the outfit pager, `addHistoryEntry()` writes a new `OutfitHistoryEntry` (id, wornAt ISO timestamp, closetId, closetName, articleIds, articleSummary) to local storage and fires a background sync to the server.

The History screen loads entries via `loadHistory()`, which tries the server first and falls back to local storage on network failure. Entries are sorted newest-first and capped at 60.

Both the Style tab and the Account → History screen use `useFocusEffect` rather than `useEffect` so the list refreshes automatically every time the screen is navigated to — ensuring it stays in sync after logging a new outfit.

**Key files**
- `src/lib/outfitHistory.ts` — `addHistoryEntry()`, `loadHistory()`, `loadLocalHistory()`
- `src/features/settings/screens/SimpleScreens.tsx` — `HistoryScreen`
- `src/features/settings/screens/PreferencesScreen.tsx` — `HistorySection` (inline timeline in Style tab)

---

### 4. Wear Pattern Visualizer

**What it does**  
A data visualization section in the Style tab showing the user's top colors (with color swatches and frequency bars) and top fabrics (with teal bars). Gives users an "aha moment" about their own style identity derived purely from what they've logged.

**How it works**  
`updatePreferences()` is called every time the user logs an outfit. It increments counters in `UserPreferenceProfile` for every color, fabric, clothing category, and color-pair that appears in the logged outfit. The visualizer reads `profile.colors` and `profile.fabrics`, sorts by frequency, and renders the top 5 colors and top 4 fabrics as relative bar charts.

The color swatches use the `CSS_COLORS` lookup table to map color names to hex values.

**Key files**
- `src/lib/userPreferences.ts` — `UserPreferenceProfile`, `updatePreferences()`
- `src/features/settings/screens/PreferencesScreen.tsx` — `PatternsSection` sub-component

---

## Tier 2 — New Capabilities

These features add genuinely new data sources or interactions.

---

### 5. AQI / Pollen Intelligence Layer

**What it does**  
Surfaces air quality and pollen data (already returned by AccuWeather but previously ignored) as pill badges in the expanded weather panel, and injects actionable notes into outfit suggestions when conditions are poor — recommending breathable fabrics for high AQI, or machine-washable synthetics during high pollen days.

**How it works**

**Data extraction (client-side)**  
AccuWeather's `details: true` current-conditions response includes an `AirAndPollen` array with entries for AirQuality, Tree, Grass, Ragweed, Weed, Mold, and UVIndex. `WeatherHUD.tsx` parses this array after every weather fetch and injects three fields into the `CurrentWeather` object before saving to state: `AirQualityText`, `AirQualityIndex`, and `PollenCategory` (the worst category across Tree / Grass / Ragweed / Weed).

No new API calls are made — the data was always present.

**Outfit notes**  
`outfitEngine.ts` reads `aqiHigh` and `pollenHigh` from `NotesContext` (populated from the new `CurrentWeather` fields) and generates notes:
- AQI unhealthy + asthma sensitivity → recommend Cotton/Linen over Polyester, suggest a mask
- AQI unhealthy (no sensitivity) → generic air quality note
- Pollen high + allergy sensitivity + natural fabrics worn → allergen trap warning
- Pollen high + allergy sensitivity + no naturals → shower/change reminder
- Pollen high (no sensitivity) → general pollen advisory

**UI badges**  
`WeatherDetails.tsx` renders `ConditionPill` badges for AQI and Pollen in the expanded weather panel. Each pill is color-coded: green (good), amber (moderate), red (high/unhealthy).

**Sensitivity settings**  
`PreferencesScreen.tsx` has an "Allergies" and "Asthma" toggle. These write to `settings.sensitivities` and control which note variants fire.

**Key files**
- `src/components/WeatherHUD/WeatherHUD.tsx` — `AirAndPollen` parsing
- `src/lib/outfit/weatherBuckets.ts` — `AQI_HIGH_LABELS`, `POLLEN_HIGH_LABELS`
- `src/lib/outfitEngine.ts` — `buildNotes()` AQI/pollen blocks
- `src/components/WeatherDetails/WeatherDetails.tsx` — `ConditionPill` badges
- `src/features/settings/screens/PreferencesScreen.tsx` — Sensitivities section
- `src/types.ts` — `CurrentWeather.AirQualityText/Index/PollenCategory`, `Settings.sensitivities`

---

### 6. Wardrobe Health Heat Map

**What it does**  
In tile view, each article card gets a subtle color overlay that encodes how recently it was worn. The palette tells you at a glance which clothes are getting stale and which were worn very recently.

**Color key**

| Overlay | Meaning |
|---|---|
| Amber tint `rgba(251,191,36,0.13)` | Worn in the last 3 days |
| None | Worn 3–14 days ago — healthy rotation |
| Soft indigo `rgba(99,102,241,0.13)` | Not worn in 14+ days (stale) |
| Stronger indigo `rgba(99,102,241,0.22)` | Never logged in Ojo at all |

**How it works**  
`ClosetView.tsx` calls `recentlyWornWithAge(30)` inside a `useFocusEffect` on every screen focus, receiving a `Map<articleId, daysSinceWorn>`. This map is passed as a `wornAge` prop to each `TileArticleCard`.

Inside `TileArticleCard`, `wornAgeOverlay(wornAge)` computes the overlay color string, which is applied as an absolutely-positioned, full-size translucent `View` layered on top of the thumbnail image.

`recentlyWornWithAge` scans local outfit history and returns the most-recent wear date for each article ID. It only reads local storage for speed — no network call on every render.

**Key files**
- `src/components/ClosetView/ClosetView.tsx` — `wornAgeMap` state, `useFocusEffect` load
- `src/components/ClosetView/ArticleCard.tsx` — `wornAgeOverlay()`, overlay `View` in `TileArticleCard`
- `src/lib/outfitHistory.ts` — `recentlyWornWithAge(withinDays)`

---

### 7. Outfit History Server Sync

**What it does**  
Syncs the local outfit history to the server so it persists across device reinstalls and is available on multiple devices. Uses an optimistic local-first pattern: writes happen instantly to local storage, and server sync runs in the background without blocking the UI.

**How it works**

**Client write path**  
`addHistoryEntry()` writes to AsyncStorage first (returning immediately), then calls `syncPost()` which fires `POST /api/history` and swallows any network error. Deletions and clears follow the same pattern.

**Client read path**  
`loadHistory()` attempts `GET /api/history`. On success, it merges server entries with local entries, deduplicating by client-generated `id`. The server result always wins for any id that appears in both — ensuring the server is the source of truth for content. Local-only entries (logged offline) are appended. The merged result is sorted by `wornAt` and saved back to local storage as the new cache.

**One-time migration**  
On the first successful server sync after an app update, `migrateLocalToServer()` checks for local entries not present on the server (by comparing id sets) and uploads them. A `ojo_history_migrated_v1` flag prevents this from running more than once.

**Server model**  
`OutfitHistory` MongoDB document: `userId` (ObjectId), `clientId` (the app-generated id string), `wornAt` (Date), `closetId`, `closetName`, `articleIds` ([String]), `articleSummary`. Two indexes: `{ userId, wornAt: -1 }` for fast timeline queries and `{ userId, clientId }` (unique) to prevent duplicates.

**Server routes**

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/history` | Last 60 entries for the authenticated user, newest first |
| `POST` | `/api/history` | Upsert by `clientId` using `$setOnInsert` — safe to call multiple times |
| `DELETE` | `/api/history/:id` | Delete a single entry by `clientId` |
| `DELETE` | `/api/history` | Clear all entries for the user |

**Key files**
- `src/lib/outfitHistory.ts` — full sync implementation
- `server/src/models/OutfitHistory.ts` — Mongoose schema + indexes
- `server/src/routes/history.ts` — CRUD routes
- `server/src/index.ts` — route registration

---

### 8. TripFit — Trip Planner

**What it does**  
Given a destination city and a date range (up to 10 days), TripFit fetches up to a 10-day daily forecast, runs the outfit engine once per day for the selected occasion, and presents a full-width paginated day-by-day outfit plan with clothing photo thumbnails, weather-gradient-tinted cards, and a grouped interactive packing list.

**UI summary**
- Inline calendar range picker (up to 10 days, month navigation, today ring)
- Occasion chips — Everyday · Work · Weekend · Date · Outdoor · Athletic — feed directly into outfit scoring
- Skeleton loading cards while the forecast fetches
- Hero banner: destination name, date range, overall temp range, dominant weather emoji
- Full-width paginated outfit pager with dot indicators and tap-to-jump
- Each day card: weather gradient tint, 4-up clothing photo thumbnail grid, "↺ Replan" button per card
- Grouped packing list (Tops · Bottoms · Outerwear · Footwear · Accessories) with tap-to-check items
- "↑ Share" button exports the grouped list as plain text via the native share sheet

All surfaces use liquid glass (`GlassCard regular` for primary cards, `GlassCard clear` for chips, checkboxes, thumbnails, and pill controls).

**How it works**

**Step 1 — City lookup**  
The user types a city name. TripFit calls `GET /api/weather/city?q={query}` to get the AccuWeather city key.

**Step 2 — 10-day daily forecast (with 5-day fallback)**  
`GET /api/weather/forecast/daily10/:cityKey` calls AccuWeather's `/forecasts/v1/daily/10day/{cityKey}`. The result is cached server-side for 3 hours. If the 10-day endpoint fails (e.g., free-tier API key), the client silently retries `GET /api/weather/forecast/daily/:cityKey` (5-day) and surfaces a "Forecast limited to 5 days" notice. The raw response is parsed into `DailyForecast[]` objects: `{ date, minTempF, maxTempF, dayPhrase, hasPrecipitation }`. Days are filtered to the user's selected start date and sliced to the trip length.

**Step 3 — Per-day outfit generation**  
For each day, `buildTripWeather(day)` synthesizes a `CurrentWeather` object from the midpoint temperature and day phrase. `generateOutfits()` is called with the user's preferred closet and `{ ...settings, occasion: selectedOccasion }` — the selected occasion chip is merged in at call time, not stored.

**Step 4 — Packing list**  
All outfit slots across all days are flattened, deduplicated by `article._id`, and grouped by category. Each item is individually checkable; checked items migrate to a "✓ Packed" sub-section.

**Step 5 — Gap notes**  
Outfit notes are recorded via `recordGapsFromNotes()` to accumulate wardrobe gap signal from the trip plan.

**Step 6 — Replan single day**  
The "↺" button on each day card re-runs `generateOutfits()` for that day only using the already-fetched `DailyForecast` (stored in `forecastDaysRef`) — no API call needed.

**Stagger entrance animation**  
Day cards slide in from below on `translateY` (no opacity animation, which would prevent `GlassView` from initialising its native blur on iOS 26). `useReduceMotion()` skips the animation entirely for users with Reduce Motion enabled.

**Entry point**  
"✈️ TripFit" button pinned below the closet list on the Closet tab → `TripFit` screen in the Account stack.

**Key files**
- `src/views/TripFit/TripFitScreen.tsx` — full UI: calendar, occasion chips, pager, skeleton, hero banner, packing list
- `src/views/TripFit/TripCalendar.tsx` — inline calendar range picker component
- `server/src/lib/accuWeather.ts` — `get10DayForecast()` and `get5DayForecast()`, both with 3-hour TTL cache
- `server/src/routes/weather.ts` — `GET /forecast/daily10/:cityKey` and `GET /forecast/daily/:cityKey`
- `src/types.ts` — `DailyForecast` interface, `OutfitOccasion` type

---

## Tier 3 — Differentiation Layer

These features are Ojo's long-term competitive moat — capabilities that compound over time as users engage more.

---

### 9. Personal Style Ranker

**What it does**  
As the user logs more outfits ("Wore this today"), the outfit scoring engine gradually shifts weight toward their personal preference history. After 30+ logged outfits, the score badge reads **"Your Score: 87 ★"** instead of "Outfit Score: 87", indicating that the rankings are now meaningfully personalized to this specific user.

The Style tab shows a **Style Ranker** card with a progress bar, level label, and the user's signature colors and top fabric — a "style fingerprint" derived entirely from what they've chosen to wear.

**How it works**

**Adaptive scoring weights**  
The outfit engine has always had a `preference` scoring factor, but it was weighted equally regardless of how much data the user had. The new `getWeights(bucket, totalOutfits)` function scales the preference weight based on data volume:

| Outfits logged | Preference weight (normal weather) | Label |
|---|---|---|
| 0–9 | 10% (baseline) | — |
| 10–29 | ~15% | learning |
| 30+ | ~22% | active / "Your Score" |

The surplus is taken proportionally from fabric, color, style, and simplicity so the weights always sum to 1.0. In extreme weather (hot / freezing), fabric still dominates — personal preference is suppressed to keep comfort paramount.

**Personalization level signal**  
`personalizedScoreLevel(totalOutfits)` returns `'none' | 'learning' | 'active'`. This is computed in `OutfitSuggestion` from the loaded `UserPreferenceProfile` and used to:
- Show the "personalizing…" sub-label during the learning phase
- Switch the badge to "Your Score ★" once active
- Color the Style DNA progress bar (grey → amber → indigo)

**Profile loading**  
`loadPreferences()` is called once on mount in `OutfitSuggestion` and again after every "Wore this today" tap (so the weight shift takes effect immediately the next time outfits are re-scored).

**Style DNA**  
`computeStyleDNA(profile)` computes the top 3 colors, top fabric, and top category by frequency count, alongside the personalization level. Displayed in the `StyleDNACard` in the Style tab's Preferences screen.

**Key files**
- `src/lib/userPreferences.ts` — `StyleDNA`, `computeStyleDNA()`, `PERSONALIZATION_THRESHOLD`, `LEARNING_THRESHOLD`
- `src/lib/outfitEngine.ts` — adaptive `getWeights()`, `personalizedScoreLevel()`, `isPersonalized` flag on `OutfitResult`
- `src/lib/outfit/types.ts` — `OutfitResult.isPersonalized?: boolean`
- `src/components/OutfitSuggestion/OutfitSuggestion.tsx` — profile loading, updated `ScoreBadge`
- `src/features/settings/screens/PreferencesScreen.tsx` — `StyleDNACard`

---

### 10. Outfit Sharing Cards

**What it does**  
A "↑ Share" button next to the score badge on every outfit card. Tapping it generates a formatted outfit card as text and opens the native share sheet — ready to paste into Messages, Instagram captions, or anywhere else.

**Share card format**
```
👔 My Ojo Outfit — Score: 87 ★
──────────────────────────
• Navy Slim Jeans (Navy)
• White Oxford Shirt (White)
• Tan Chelsea Boots (Tan)

🌤️ 64°F · Partly cloudy

Styled with Ojo
```

The ★ only appears when the score is personalized (Feature 9 active). The weather line uses live temperature and weather text from the same `CurrentWeather` object used to generate the outfit.

**How it works**  
`handleShare` is a plain function (not a hook) defined inside `OutfitSuggestion` after the active outfit is confirmed. It builds the share string from `activeSlots` and calls `Share.share({ message })` from `react-native` — the native share sheet handles the rest. No new dependencies, no screenshots, no servers.

**Key files**
- `src/components/OutfitSuggestion/OutfitSuggestion.tsx` — `handleShare`, "↑ Share" `Pressable`
- `src/components/OutfitSuggestion/OutfitSuggestion.styles.ts` — `shareBtn`, `shareBtnText`, `scoreBadgeRow`

---

### 11. Scan Outfit — Vision Capture

**What it does**  
"Score what you're wearing today." A camera-powered flow where the user photographs each garment they have on. Ojo's on-device TFLite model identifies each garment, matches it to the best article in the user's closet, assembles the matched articles into an outfit, and scores it — giving real-time AI feedback on an actual outfit in the world, not a hypothetical one.

**How it works**

**Step 1 — Photo capture**  
The user taps "📷 Camera" or "🖼️ Library" (up to 4 times). Each selection calls `captureImage()` or `pickImage()` from `imageService.ts` — the same functions used when adding articles to the closet.

**Step 2 — On-device identification**  
`identifyClothing(localUri)` runs the full pipeline:
1. TFLite inference → garment type (34 classes) + sleeve length
2. Sleeve override rules (e.g., "t-shirt + long-sleeve" → "long-sleeve-shirt")
3. `colorExtractor` → dominant colors from the image pixels
4. Heuristic fabric guess from garment type

The dominant color name and `GarmentType` are extracted from the result.

**Step 3 — Closet matching**  
`matchToCloset(formType, detectedColor, articles)` maps the detected `GarmentType` to the app's form `clothingType` via `GARMENT_TO_FORM_TYPE`, then searches the user's preferred closet for articles with the same type. If multiple articles match the type, the one whose color most closely matches the detected color wins. If no article in the closet matches at all, a minimal synthetic `ClothingArticle` is constructed from the scan data as a stand-in.

**Step 4 — Scoring**  
`generateOutfits()` is called with the matched/synthetic articles as the full "closet". The engine scores all valid combinations of those articles and returns the highest-scoring result. A neutral `CurrentWeather` (68°F, partly cloudy) is used since the scan is about the outfit itself, not the forecast.

**Step 5 — Result display**  
The score badge (personalized-aware: "Your Score ★" if Feature 9 is active), a five-factor breakdown bar chart, and any outfit notes are shown inline on the same screen.

**Each scanned item card shows:**
- Thumbnail of the photo
- Detected garment type and dominant color
- Whether a closet match was found (green "✓ Matched: Navy Slim Jeans") or a synthetic stand-in was used
- ML confidence percentage

**Entry point**  
A "📷 Scan" pill button in the home screen outfit header, next to the score badge and Share button. Navigates to the `ScanOutfit` screen in the Account stack.

**Key files**
- `src/views/ScanOutfit/ScanOutfitScreen.tsx` — full scan UI and orchestration logic
- `src/services/clothingIdentifier.ts` — `identifyClothing()` TFLite pipeline
- `src/components/ArticleModal/detection.ts` — `GARMENT_TO_FORM_TYPE` mapping
- `src/lib/imageService.ts` — `captureImage()`, `pickImage()`
- `src/navigation/AccountStack.tsx` — `ScanOutfit` screen registration
- `src/components/OutfitSuggestion/OutfitSuggestion.tsx` — "📷 Scan" entry button

---

## Feature Interaction Map

Some features are more powerful in combination:

| When you combine… | You get… |
|---|---|
| **Server Sync** + **History Screen** | History that survives reinstalls and syncs across devices |
| **Style Ranker** + **Occasion Quick-Switch** | Personalized suggestions that also respect the moment (Work Monday, Date Friday) |
| **Heat Map** + **History** | A visual answer to "what am I actually wearing vs what I think I wear" |
| **Scan Outfit** + **Style Ranker** | Your real-world outfit scored against your own learned preferences, not generic rules |
| **TripFit** + **Gap Card** | A packing plan that also surfaces what you'd need to buy for the trip |
| **TripFit** + **Occasion Quick-Switch** | Per-trip occasion selection (e.g. "Work" for a conference trip, "Athletic" for a ski trip) shapes every day's outfit independently |
| **AQI/Pollen** + **Sensitivities** | Outfit notes that are personalized to your health context, not generic weather advice |

---

## Navigation Map

```
Root Navigator
├── App (AppTabs)
│   ├── Home tab        → MainPage → WeatherHUD → OutfitSuggestion
│   │                       ├── Occasion chips        [Feature 1]
│   │                       ├── Gap card              [Feature 2]
│   │                       ├── Score badge + Share   [Features 9, 10]
│   │                       └── 📷 Scan button        [Feature 11]
│   ├── Closet tab      → ClosetPage → ClosetView
│   │                       ├── Tile heat map overlays [Feature 6]
│   │                       └── ✈️ TripFit button      [Feature 8]
│   └── Style tab       → PreferencesScreen
│                           ├── History timeline       [Feature 3]
│                           ├── Wear pattern bars      [Feature 4]
│                           ├── Style Ranker DNA card  [Feature 9]
│                           └── Sensitivities toggles  [Feature 5]
│
└── Account (AccountStack)
    ├── Settings
    ├── History                                        [Feature 3]
    ├── TripFit                                        [Feature 8]
    └── ScanOutfit                                     [Feature 11]
```
