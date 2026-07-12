# Ojo Layering Intelligence Engine — B2B Licensing Plan

*Drafted 2026-07-11. Based on a direct read of `src/lib/outfitEngine.ts`,
`src/lib/layeringEngine.ts`, and their submodules — see
[b2b-licensing-notes.md](b2b-licensing-notes.md) for the exploration record.*

---

## 1. What we're licensing (as actually built)

A **pure-TypeScript, zero-dependency decision engine** (~2,500 LOC + tests) that turns
*(wardrobe inventory, current weather, hourly forecast, user preferences)* into ranked,
explained, weather-aware outfit recommendations. Two composable stages:

1. **Outfit Engine** — `generateOutfits()`: combinatorial candidate generation over a
   7-role garment model, scored on five explainable factors (fabric×weather with heat
   index/rain-resilience/wind physics, color harmony with clash detection, style affinity
   across 10 styles, simplicity, learned preference), with occasion targeting, recency
   rotation, diversity filtering, and graduated personalization. Returns top-K outfits
   with 0–100 scores, per-factor breakdowns, and human-readable notes.

2. **Layering Intelligence Engine** — `buildLayeringContext()` + 
   `generateLayeringRecommendation()`: base/mid/outer analysis with NWS wind-chill-driven
   layer necessity, removability scoring, **an hour-by-hour layering timeline** ("Remove
   jacket early afternoon — warming up; add it back at evening — sun is setting"), driven by
   temperature inflections, precipitation transitions, and sunset detection; a
   natural-language recommendation across ~15 scenario branches; a confidence score; and
   **structured wardrobe-gap flags** (`missingMid`/`missingOuter`).

**Properties that make it licensable (all verified in code):**

- **Pure functions, no I/O.** Runs on-device, on the edge, or server-side. No network, no
  database, no model weights. Closet data never has to leave the licensee's app — a real
  privacy story.
- **Deterministic and explainable.** Every score decomposes into auditable sub-scores;
  every recommendation has a stated reason. No hallucinations, no inference bill, ~0ms
  latency. (Contrast: LLM-stylist features cost $0.001–0.01/call and 1–5s latency.)
- **Weather-native.** Real formulas (NWS wind chill, simplified heat index, precipitation
  intensity grading), hourly-forecast reasoning, sunset awareness. This is the moat — closet
  apps do style, weather apps do weather, almost nobody does the intersection this deeply.
- **ML-ready.** `ENGINE_VERSION` stamping + `buildWearContext()` already instrument wear
  logs as training data; the scorer is architected to be swapped for a learned ranker later.
  That's a roadmap we can sell, not vapor.
- **Tested (with one caveat).** 46 unit tests across 8 suites, all green (buckets, color
  harmony, roles, seasons, day-range, layer extraction, preferences, engine smoke test).
  Caveat: the layering timeline/NL/confidence logic has no *direct* suite yet — writing one
  is a pre-pilot task and the safety net for the extraction refactor.

**Adjacent IP that sweetens the bundle (verified on second pass):** `wardrobeGaps.ts` adds
a persistence layer over the gap flags — rolling 30-day window, suggestion fires after 4
occurrences — turning one-off "missing coat" flags into *qualified* purchase-intent signals.
`insightsEngine.ts` (cost-per-wear, utilization, sleeping items) is a natural closet-app
upsell module. `tripMode.ts` + TripFit is the travel/packing angle for airline/hotel apps.
None are v1 blockers; all are named expansion SKUs.

**Constraints we disclose up front** (details in notes §3): imperial units internally,
English-only prose, fixed ~25-type garment taxonomy, AccuWeather/WeatherKit-shaped input
types. All addressed by a thin adapter layer in the productization work below.

---

## 2. Target customer profile

**Segment A — Weather apps (beachhead).**
Indie and mid-size weather apps (Carrot Weather-tier down to long-tail), widget makers, and
weather-data platforms hunting for engagement features beyond the forecast. They already have
the exact input the engine needs (current + hourly feels-like, precip, wind, UV) and are
starved for daily-habit features. "What to wear" is a top-requested weather-app feature;
none do closet-aware layering timelines. Buyer: founder/head of product. Deal size: low
five figures. Sales cycle: weeks.

**Segment B — Digital closet / wardrobe apps.**
Whering, Indyx, Acloset, OpenWardrobe-class apps and new entrants. They have the closet
inventory but weak weather logic (typically "it's cold, wear a coat"). The layering
timeline + gap detection is a visible, demoable differentiator. Buyer: same profile.
Risk: some see recommendations as their own core IP — qualify for that early.

**Segment C — Fashion e-commerce & retail (largest checks, slowest cycle).**
Retailers and outfitting platforms (the Stylitics/Dressipi/FindMine category, which sells
outfitting AI at six figures). Our angle is narrower and cheaper: weather-aware "complete
the outfit" and **gap-to-cart** — `missingOuter` on a cold snap is a purchase intent signal
with built-in justification copy — and `wardrobeGaps.ts` already persists these into
qualified signals ("needed a coat 4× in 30 days"). Also: travel/packing (hotel apps, airline
apps) using the same engine against a trip forecast. Pursue opportunistically in year one,
not as beachhead. Qualifying bar (borrowed from Stylitics' own ICP): retailers ~$50M+ annual
online revenue — below that, route them to Growth/Scale tiers instead of custom deals.

**Anti-profile (walk away):** anyone needing image-based visual similarity, full i18n on day
one, or a guaranteed ML personalization roadmap this quarter.

---

## 3. Integration model: SDK-first licensed module, API as convenience

**Primary: `@ojo/outfit-engine` — a licensed npm package (private registry).**
The engine's advantages (0ms, offline, private, free-per-call) only exist in-process.
Ship as a versioned TypeScript package with:

- **Adapter layer** (the productization work): `WeatherAdapter` interface with prebuilt
  mappers for AccuWeather (native shape today), Apple WeatherKit, OpenWeatherMap,
  Tomorrow.io; unit handling (°C/°F); injectable clock; a documented garment-taxonomy
  mapping guide (licensee types → our 25-type model, with graceful-degradation notes).
- **Structured-output mode**: licensees can ignore our English prose and render the
  structured fields (timeline steps, gap flags, score breakdown, confidence) in their own
  copy/language/brand voice — this defers i18n instead of blocking on it.
- License-key + telemetry ping (MAU self-report verification, version tracking).

**Secondary: hosted REST API** (`POST /v1/outfits` with closet + weather + settings JSON)
for non-JS stacks and quick pilots. Same engine behind it; per-call metered; positioned as
the on-ramp, with migration-to-SDK as the cost-saving upsell.

**Explicitly not offered (v1):** source purchase (kills upgrade revenue — offer escrow
instead), white-label of the whole Ojo app (parked — see notes §5).

**Productization work required before first paid pilot (~2–3 engineering weeks, validate):**
extract package from app repo (drop `../types` coupling), °C/clock/**hemisphere** adapters
(`currentSeason()` is hardcoded Northern Hemisphere), a direct layeringEngine test suite
(refactor safety net), docs + integration quickstart including the color/garment taxonomy
mapping guide (colors are English named strings; unknowns silently score neutral),
benchmark, license key plumbing.

---

## 4. Pricing

Metering principle: **MAU-based with annual floors** for the SDK (client-side calls can't be
honestly metered; per-call pricing would force server deployment and kill the privacy
pitch), per-call only on the hosted API tier.

| Tier | Price | Includes | For |
|---|---|---|---|
| **Design Partner (pilot)** | Free for 90 days, then converts to Growth | SDK ≤ 25k MAU or API ≤ 100k calls/mo, 1 app, direct Slack support, named case study + feedback obligations | First 3–5 licensees only |
| **Starter** | $499/mo | API only, ≤ 250k calls/mo, community support | Non-JS stacks, experiments |
| **Growth** | $1,990/mo (annual) | SDK ≤ 100k MAU, 2 apps, taxonomy-mapping workshop, minor-version updates, email/Slack support | Segments A & B core |
| **Scale** | $4,990/mo + $25 per additional 1k MAU over 250k | SDK ≤ 250k MAU, priority support, quarterly roadmap input | Larger consumer apps |
| **Enterprise / OEM** | From $75k/yr, custom | Unlimited MAU per negotiated scope, custom taxonomy + copy voice, source escrow, SLA, co-marketing rights, optional rev-share on gap-to-cart conversions (2–4% of attributed revenue) | Segment C, device OEMs |

Notes:
- Anchors sanity-checked against the market (2026-07 scan): weather-data self-serve runs
  free→$35/mo entry up to six-figure enterprise contracts; Stylitics-class outfitting AI is
  100% custom-quoted at enterprise scale. Our ladder matches what Segment A buyers already
  purchase; Enterprise has headroom — price that tier by value story (attributed
  conversion), not by MAU.
- Annual prepay discount ~15%. Updates included while subscribed; lapse = keep last version,
  lose updates and key renewals per license terms.
- The gap-to-cart rev-share is optional sweetener for retail deals where flat fees stall.

---

## 5. First pilot conversation — script

**Who:** head of product / founder at a Segment A or B app (10k–500k MAU).
**Goal:** leave with a signed 90-day design-partner pilot and a named KPI. Not a sale.

**1. Discovery (10 min).** Qualify before demoing:
- "What does your daily-open engagement look like, and what have you tried to move it?"
- "What weather data do you already pay for?" (A: they have it. B: this may be their blocker
  — have the WeatherKit/OpenWeather adapter answer ready.)
- "Do you have any garment/closet data model today?" (B: yes → taxonomy mapping talk.
  A: no → start with the closet-free 'capsule mode' — see step 2.)
- "Is outfit recommendation something you consider core IP, or a feature you'd rather buy?"
  (Walk away politely if the former.)

**2. Demo (10 min).** Live, with *their* city's real forecast that day:
- A variable day: show the ranked outfits, then the layering timeline — "Remove jacket early
  afternoon; add it back at evening, sun is setting." That line is the demo. Nobody else has it.
- Toggle a preference (runs-warm threshold, style, occasion=work) → recommendations shift,
  with the score breakdown visible. "Deterministic and explainable — you can screenshot why."
- Show `missingOuter` firing on a cold-snap day → "this flag is a native shopping placement."
- For weather apps without closet data: demo against a small default "capsule wardrobe" so
  value shows before any user closet exists (progressive: generic → user closet → learned
  preferences after 30 logged outfits).

**3. Objection pre-emption (5 min).** Say these before they do:
- *"Why not just call an LLM?"* — per-call cost at their MAU × daily opens, latency,
  non-determinism, and privacy (closet + location leaving device). We're the free-per-call,
  0ms, on-device option; they can still layer an LLM over our structured output for prose.
- *"Our taxonomy doesn't match."* — mapping guide + workshop is included; unknown types
  degrade gracefully (show it).
- *"Metric units / non-US?"* — adapter handles °C; v1 prose is English, structured-output
  mode lets them localize; native i18n is on the paid roadmap.

**4. Pilot proposal (5 min).** 90 days, free, capped MAU. One success metric agreed in the
meeting, e.g.: **≥15% lift in D7 retention among users who see the outfit card** (A), or
**≥20% of DAU engaging the layering timeline** (B), or **CTR on gap-driven product
placements** (C). Weekly check-in, case-study rights on success, pre-agreed conversion to
Growth tier pricing so there's no re-negotiation cliff.

**5. Close.** "You bring your weather feed and a test build; we bring the SDK and sit with
your team for integration week. If the metric doesn't move in 90 days, you walk away having
paid nothing."

---

## 6. Sequencing

1. **Weeks 1–3:** package extraction + adapters + docs (the only blocking engineering).
2. **Weeks 2–4 (parallel):** build the demo harness (web page: pick a city, pick a capsule
   wardrobe, see outfits + timeline live) — this is the sales asset.
3. **Weeks 4–8:** 10–15 targeted outreaches in Segments A/B; goal = 3 design partners.
4. **Month 3–6:** convert 1–2 partners to paid Growth; use case studies to open Segment C
   conversations with the rev-share story.
5. **Ongoing:** log-derived ML ranker (the architecture is already instrumented for it) as
   the year-two differentiator and Enterprise upsell.
