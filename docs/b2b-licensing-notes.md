# B2B Licensing — Working Notes

Running notes from the exploration + product-design pass (2026-07-11, Claude session;
**second pass completed same day** — see §7). The finished plan lives in
[b2b-licensing-plan.md](b2b-licensing-plan.md). These notes record what was examined,
what was concluded, and why — for later passes.

---

## 1. What was actually read (don't trust summaries — re-read these if anything changed)

- `src/lib/outfitEngine.ts` (1069 lines) — full read
- `src/lib/layeringEngine.ts` (599 lines) — full read
- `src/lib/outfit/types.ts`, `src/lib/layering/types.ts` — full read
- `src/lib/outfit/weatherBuckets.ts`, `src/lib/outfit/roles.ts` — full read
- `src/lib/layering/extractLayers.ts`, `src/lib/layering/dayRange.ts` — full read
- `src/lib/userPreferences.ts` — full read (2nd pass; profile derivation, StyleDNA, pairing bonus)
- `src/types.ts` — `CurrentWeather`, `Forecast`, `DailyForecast`, `Settings`, `ClothingArticle`
- 2nd pass: `colorHarmony.ts`, `seasons.ts`, `roles.ts` — full read; `wardrobeGaps.ts`,
  `insightsEngine.ts`, `tripMode.ts` — headers + public API skimmed (findings in §7)
- Still NOT read: `recapEngine.ts`, full bodies of wardrobeGaps/insightsEngine/tripMode

Note: multiple stale copies of the codebase exist in `~/Downloads/Ojo*`. The canonical copy
(the only one with `layeringEngine.ts` + tests) is `~/Desktop/Ojo`. All reads were from there.

## 2. What the engine actually is (verified against code, not the app's marketing)

**Two-stage pure-function pipeline, zero I/O, zero network, zero ML runtime:**

`generateOutfits(articles, weather, settings, recentlyWorn?, topK?, profile?, forecasts?)`
→ `{ results: OutfitResult[], status: 'ok' | 'empty_closet' | 'insufficient' }`

Pipeline: hard climate filter → role bucketing (~25 clothingType → 7 roles) → per-role top-8
pre-rank by fabric score → full combinatorial enumeration (core × mid × outer × footwear ×
accessory-pairs with body-zone conflict avoidance) → two-pass pruning when >200 core combos
(fabric-only cheap pass keeps top 50) → 5-factor weighted composite score → recency decay
penalty → dedup + diversity filter (≥2 core-item difference) → top-K. Optional "mood" mode:
one outfit per user style + a wild card.

Scoring factors (each 0–1, weighted; weights shift when weather is extreme and as
personalization data accumulates):
- **fabric × weather**: lookup table per fabric per bucket, modified by rain resilience ×
  precipitation intensity, NWS simplified heat index (humidity × temp interaction), wind
  density bonus, snow/boots bonus, then blended 70/30 with a garment thermal-alignment score
  (garment warmth model = clothingType base + fabric modifier vs. linear ideal-warmth-for-
  feels-like curve).
- **color harmony**: pairwise harmony, avg blended 70/30 with the *worst* pair (so one clash
  isn't hidden), + seasonal palette bonus + learned color-pair bonus. Clash detection
  identifies the specific offending item for swap suggestions.
- **style**: affinity tables for 10 named styles (Casual, Streetwear, Cozy, Preppy, …).
- **simplicity**: neutral-base + one-accent principle.
- **preference**: learned from outfit history (count-based profile, derived view over last
  60 logged outfits — not persisted separately; graduated weight at 2 thresholds).
- **occasion**: formality-range targeting (work/date/weekend/athletic/outdoor) as a modifier.

Output per outfit: slots, 0–100 score, 5-part `scoreBreakdown`, headline, prose `notes[]`
(wardrobe gaps, precip/UV/AQI/pollen warnings with user-sensitivity awareness, fabric-care
warnings, clash callouts), structured `accessoryAlerts` for widgets, `moodLabel`,
`isPersonalized`, and a `layering` result.

**Layering engine** (the crown jewel for differentiation):
`buildLayeringContext({weather, forecasts, settings})` once per weather snapshot, then
`generateLayeringRecommendation({context, slots})` per outfit →
- base/mid/outer extraction from already-chosen slots (never re-selects),
- signal-based layer necessity (NWS wind-chill formula, day temp-swing logic, hot-weather
  override, rain-driven outerwear),
- removability heuristic (type + fabric → can you shed it midday),
- **intra-day timeline**: up to 5 chronological add/remove-layer steps from temperature
  inflection points, precipitation start/stop transitions, and sunset estimation from
  forecast `IsDaylight` flags,
- natural-language recommendation across ~15 scenario branches (missing-layer urgency,
  extra-layer reassurance, hard-to-remove caveats, wind notes),
- confidence 0–1 (variability, wind, gaps, extremes discount/boost),
- `missingMid`/`missingOuter` wardrobe-gap flags — **directly monetizable as shoppable
  gap detection**.

Also present and relevant: `ENGINE_VERSION` constant + `buildWearContext()` — the engine
is already instrumented to log training data for a future ML ranker swap ("replace
scoreOutfit() with model inference" is stated in the header comment).

## 3. Honest technical constraints (surface these in any pilot; don't oversell)

- **Imperial-only internals** (°F, mph, in/hr) — NWS formulas. Needs a °C adapter for intl.
- **English-only** NL generation, hardcoded strings, US idiom ("Bundle up today").
- **Fixed taxonomy**: ~25 clothingType strings, 10 fabrics, 10 styles. Unknown types fall
  back to 'top'/0.30 warmth/0.50 scores — degrades gracefully but silently.
- **Weather schema is AccuWeather-shaped** (`RealFeelTemperature.Imperial.Value`,
  `IconPhrase`, `IsDaylight`); the app comments mention WeatherKit compat. Any licensee on
  OpenWeather/Tomorrow.io needs a mapping adapter (thin, ~1 day of work each).
- **Heuristic, not ML** — this is a *selling point* (deterministic, explainable, zero
  inference cost, runs offline/on-device) but per-item personalization is count-based.
- `new Date()` used internally (seasonality, morning-blend, sunset fallback) — engine is
  not fully pure w.r.t. clock; needs an injectable clock for server-side/testing use.
- Coupled to app types via relative imports (`../types`) — needs extraction into a
  standalone package before any external delivery.
- Northern-hemisphere season assumptions (sunset fallback, `currentSeason` likely).

## 4. Key product judgments made (and why)

- **SDK-first, not API-first.** The engine is a pure, small TS library. Its biggest
  competitive advantages — zero latency, zero marginal cost, offline, privacy (closet data
  never leaves device) — all evaporate behind a hosted API. A hosted API is offered only as
  a convenience tier for non-JS stacks. This also matches how the code was built.
- **License the module, meter by MAU.** Client-side calls can't be metered honestly;
  per-call pricing would force server-side deployment and kill the privacy story. MAU
  self-reporting + annual floor is the industry-standard resolution (cf. Mapbox SDK, Algolia).
- **Weather-nativeness is the wedge.** Outfit recommenders exist (Whering, Acloset, Style DNA
  do closet + style). Almost none do hour-by-hour layering timelines, wind-chill-driven layer
  necessity, precipitation-transition advice, sunset-aware re-layering. Weather apps have the
  audience and the data but not the wardrobe logic. That intersection is the pitch.
- **Wardrobe-gap flags are the commerce hook.** `missingMid`/`missingOuter` + the prose gap
  notes convert directly into affiliate/shoppable placements — that's the revenue-share story
  for retail-adjacent licensees.
- **Do NOT position against LLM stylists on quality; position on cost/latency/determinism.**
  An LLM can write richer prose. It cannot run in 0ms on-device for free with reproducible
  output and a scoring audit trail. Also the NL layer here is swappable: licensees can feed
  the structured output (timeline, flags, breakdown) into their own copy/LLM.
- **Pricing anchored to comparable dev-tool/SDK norms** (weather APIs, personalization SDKs):
  design-partner pilot cheap/free, growth tier ~$1.5–3k/mo, OEM ~$50–150k/yr. Numbers in the
  plan are first-pass anchors for conversation, not validated by market research — flag for
  second pass (competitive pricing scan of Stylitics, Dressipi, FindMine, True Fit, which
  sell outfitting AI to retail at enterprise prices — they're the closest comps and charge
  6 figures, which suggests upside room in the retail segment).

## 5. What was tried / considered and rejected

- **Per-recommendation API pricing as primary** — rejected (see metering argument above).
- **Source-code sale / perpetual license as default** — rejected; keeps leverage and upgrade
  revenue with annual subscription + escrow-on-enterprise instead.
- **Consumer white-label app licensing** (sell the whole Ojo app skinned) — parked, not
  rejected. Bigger deal size but way more surface area (server, auth, vision pipeline).
  Engine-only licensing is the fastest credible product. Revisit if a hotel/retail brand asks.
- **Positioning to fashion e-comm as primary segment first** — demoted to segment #2.
  Enterprise retail sales cycles are 6–12 months and they'll ask for image-based similarity
  we don't have. Weather + closet apps are faster wins and better proof points.

## 6. Open items

- [x] Read adjacent modules — done 2nd pass, findings in §7.
- [x] Run the existing test suite — done 2nd pass: **46/46 pass across 8 suites**
      (weatherBuckets, colorHarmony, roles, seasons, dayRange, extractLayers,
      userPreferences, outfitEngine smoke). **Gap: `layeringEngine.ts` itself has no direct
      suite** — the timeline builder, ~15 NL branches, removability, and confidence math are
      only exercised indirectly via the smoke test. Write a direct suite before demoing
      "tested engine" to a prospect (also needed as a safety net for the extraction refactor).
- [x] Competitive pricing scan (first pass, web) — done 2nd pass, findings in §7.
- [ ] Decide package name + legal entity for licensing (Ojo is consumer brand — separate
      "engine" brand?).
- [ ] Extraction spike: how many hours to get `@ojo/outfit-engine` building standalone with
      an injected clock, unit adapter, and weather adapter interface? (Estimate in plan: ~2–3 wks
      to pilot-ready; validate.)
- [ ] °C + i18n architecture decision (string templates vs. structured-output-only for intl
      licensees).
- [ ] Direct test suite for layeringEngine.ts (see above) — pre-pilot engineering item.
- [ ] Deeper Segment C comp research: Dressipi / FindMine / True Fit specifics; find any
      published case-study deal sizes.

## 7. Second-pass findings (2026-07-11, same day)

**Adjacent-IP reads — bundle assessment:**

- `colorHarmony.ts` — 12-position RYB color wheel over ~45 named colors + neutral/metallic
  sets; interval-theory pair scoring. Constraint worth disclosing: colors are **English named
  strings**; unknown colors silently score 0.7. Fine for licensees mapping to our palette;
  another taxonomy-mapping item for the integration guide.
- `seasons.ts` — `currentSeason()` is **hardcoded Northern Hemisphere** (month ranges) and
  uses `new Date()`. Confirms notes §3: southern-hemisphere licensees get inverted seasonal
  color bonuses until we inject hemisphere/clock. Small fix, must be in the extraction work.
- `roles.ts` — confirms 25-type→7-role map, body-zone conflict logic for accessory pairs,
  unknown types → 'top'. Matches what the plan claims.
- `wardrobeGaps.ts` — **strengthens the gap-to-cart story beyond what the plan claimed**:
  it's not just instantaneous `missingOuter` flags; there's a persistence layer (rolling
  30-day window, suggestion fires after 4 occurrences) that turns one-off flags into
  qualified purchase-intent signals ("you've needed a coat 4× this month"). Storage-coupled
  (AsyncStorage) but the thresholding logic is trivially extractable. Add to Enterprise/
  retail pitch.
- `insightsEngine.ts` — pure computation over closets + history: cost-per-wear, utilization,
  sleeping items, wardrobe value, Style DNA. Natural **closet-app upsell module** ("wardrobe
  analytics"), not core to v1.
- `tripMode.ts` — pure trip-selection logic (date window ∩ GPS proximity, forecast-drift
  detection). Together with TripFit, this is the **travel/packing licensing angle** (airline/
  hotel apps): same engine run against a destination forecast. Keep parked but name it in
  Segment C conversations.

**Test suite:** 46/46 green (see §6). Claim "unit-tested submodules + smoke-tested engine,"
not "fully tested," until the layeringEngine suite exists.

**Pricing scan (web, 2026-07):**
- Stylitics: no public pricing; custom quotes; targets retailers **$50M+ annual online
  revenue, 1000+ SKUs**; ~45-day implementation. Confirms Segment C is six-figure/custom
  territory and slow — and gives us a clean qualifying criterion for when to even attempt it.
  (stylitics.com/pricing, saasgenius.com, softwarefinder.com)
- Weather-data market: self-serve from free/$35/mo (Visual Crossing, Open-Meteo,
  OpenWeather per-record at ~$0.0015) up to six-figure enterprise contracts (OpenWeather
  corp, Tomorrow.io enterprise). Confirms our $499→$4,990/mo self-serve ladder + custom
  Enterprise is shaped like what Segment A buyers already purchase.
- Net: plan's pricing anchors stand. No change made to the tier table.
