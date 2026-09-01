# WeatherKit call-cost reduction plan

Four changes — three in `server/`, one in the app — in dependency order.
Together they cut WeatherKit API calls per cold load from **3 → 1**, widen cache
sharing between nearby users by ~100×, stop every deploy from flushing the
cache, and stop the app re-fetching data it already holds.

None of this touches the app's rendering. It is orthogonal to the weather
backdrop work.

**Read the honesty note in Phase 4 before sequencing it.** Phases 1 and 2 are
the quota levers. Phase 4 is mostly a hosting/latency/UX win with a narrow but
real quota effect, and it is easy to overestimate.

## Status

| Phase | State |
|---|---|
| 0 — instrumentation | **Implemented** |
| 1a + 1b — bundle + coalesce | **Implemented** |
| 2 — snap + coarsen | **Implemented** |
| 3 — Mongo L2 | **Implemented** — L2 logic verified against a stubbed model; real Mongo persistence and TTL-index creation still need a deploy smoke test |
| 4 — client gate | Not started |
| 1c — bundle route | Not started (optional) |

---

## Background: how calls are counted

Apple, [Developer Forums thread 750791](https://developer.apple.com/forums/thread/750791):

> That is a single request that returns two different data sets. Each call to
> `WeatherService.weather` counts as a single request. If you split that into
> two different calls each call would count separately against your usage quota.

One HTTP request = one call, regardless of how many `dataSets` it carries.
`dataSets` selects **datasets, not fields** — there is no field projection, so
every response already contains `cloudCover`, `windGust`, `windDirection`,
`pressureTrend` and `visibility` whether or not `WKCurrent` declares them.

### What we do today

`callWeatherKit` (`server/src/lib/weatherKit.ts`) is invoked three separate
times, each with a single-element `dataSets` array and therefore its own cache
key:

| Caller | dataSets | Cache key suffix |
|---|---|---|
| `getCurrent` | `currentWeather` | `:currentWeather` |
| `getHourly` | `forecastHourly` | `:forecastHourly` |
| `getDaily` | `forecastDaily` | `:forecastDaily` |

`WeatherHUD` fires all three in a `Promise.all`, so **one cold main-page load
costs 3 WeatherKit calls where 1 would do.**

The `dataSets: DataSet[]` parameter already joins with commas. The plumbing for
a bundled request exists; only the three call sites pass single-element arrays.

---

## Phase 0 — Instrumentation (prerequisite)

You cannot verify a 3× reduction without a before number, and there is no
upstream-call telemetry today.

**`server/src/lib/weatherKit.ts`**

```ts
let upstreamCalls = 0;
let cacheHits     = 0;
let coalesced     = 0;

export const weatherStats = () => ({ upstreamCalls, cacheHits, coalesced });
export const resetWeatherStats = () => { upstreamCalls = cacheHits = coalesced = 0; };
```

Increment `upstreamCalls` immediately before each `wk.get`, `cacheHits` on each
cache hit, `coalesced` on each in-flight join (Phase 1).

**`server/src/index.ts`** — fold into the existing `startMemoryLogging` line so
it lands in Railway's log view alongside RSS:

```
[weather] upstream=142 hits=1203 coalesced=284 (last 15m)
```

Reset the counters after each emit so the numbers are per-interval, not
cumulative. Also expose `weatherStats()` on `/health` for spot checks.

**Acceptance:** a cold load of the main page logs `upstream=3`. That is the
baseline Phase 1 must move to 1.

---

## Phase 1 — One upstream call per location

### 1a. Bundle the datasets

Replace the three single-dataset fetches with one bundled fetch. The three
public getters become selectors over a shared response.

```ts
const BUNDLE: DataSet[] = ['currentWeather', 'forecastHourly', 'forecastDaily'];

async function fetchBundle(lat: number, lon: number): Promise<WKResponse> { … }

export async function getCurrent(lat, lon) {
  const c = (await fetchBundle(lat, lon)).currentWeather;
  if (!c) return null;
  /* …existing normalisation, unchanged… */
}
```

`getCurrent` / `getHourly` / `getDaily` keep their exact signatures and return
types, so **`routes/weather.ts` and `services/notificationService.ts` need no
changes**, and neither does the app.

### 1b. In-flight coalescing — *this is what makes 1a actually work*

Without it, Phase 1a saves nothing on the main path. `WeatherHUD` fires three
requests in parallel; all three miss the cache in the same tick and all three
start their own upstream fetch. The bundle must be de-duplicated by an
in-flight promise map, not just by the cache.

```ts
const inFlight = new Map<string, Promise<WKResponse>>();

async function fetchBundle(lat: number, lon: number): Promise<WKResponse> {
  const { lat: sLat, lon: sLon } = snapCoords(lat, lon);   // Phase 2
  const key = cacheKeyFor(sLat, sLon);

  const cached = await cacheGet<WKResponse>(key);          // Phase 3
  if (cached) { cacheHits++; return cached; }

  const existing = inFlight.get(key);
  if (existing) { coalesced++; return existing; }

  const p = (async () => {
    try {
      upstreamCalls++;
      const { data } = await wk.get<WKResponse>(`/${language}/${sLat}/${sLon}`, {
        params:  { dataSets: BUNDLE.join(',') },
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (data) await cacheSet(key, data, DATA_TTL_MS);
      return data;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, p);
  return p;
}
```

Notes:

- **Delete inside the `finally` of the async body**, not via `.finally()` on the
  outer promise — the latter creates a new promise and leaves a window where a
  late caller joins a settled entry.
- **Do not cache rejections.** A failed fetch should leave the cache empty so
  the next request retries. Coalescing still applies to failures: a burst of
  three during a WeatherKit outage produces one upstream error, not three.
- Every joined caller shares one response object. Nothing downstream mutates it
  (all normalisers read-and-copy), but keep it that way.

### 1c. Optional: a single client-facing route

Add `GET /api/weather/bundle` returning `{ current, hourly, daily }`, and
collapse `WeatherHUD`'s `Promise.all` of three `api.get` calls into one.

This saves **zero** Apple quota — Phase 1b already did that. It saves two HTTPS
round trips and two `requireAuth` passes per load, which is latency and your own
hosting cost. Keep the three existing routes so older app builds keep working.

Do this any time after 1b, or not at all.

### Trade-off

`runAfternoonCheck` only needs `currentWeather` but now pulls hourly and daily
too. Still **1 call instead of 1** — no quota change, just a larger response
body. `runMorningCheck` goes from 2 calls to 1.

### Expected result

`upstream` per cold load: **3 → 1**. Every downstream consumer unchanged.

---

## Phase 2 — Coarsen and snap the cache key

Today: `round3` → 3 decimal places ≈ **110 m**. Every 110-metre grid cell is its
own cache entry, so two users on adjacent blocks share nothing.

```ts
const PRECISION = Number(process.env.WEATHER_CACHE_PRECISION ?? 2);

function snapCoords(lat: number, lon: number) {
  const f = 10 ** PRECISION;
  return { lat: Math.round(lat * f) / f, lon: Math.round(lon * f) / f };
}
```

**Snap the request coordinates, not just the key.** If you key at 0.01° but
still request exact coordinates, the cached payload is whatever the first
requester's precise position happened to return — non-deterministic across cache
generations. Snapping means every user in a cell gets byte-identical data.

### Accuracy

- 0.01° latitude = 1.11 km. Worst-case displacement from snapping is half the
  cell diagonal ≈ **785 m** at the equator.
- Longitude cells narrow by cos φ — ~555 m at 60° latitude. That is the safe
  direction: finer cells, fewer collisions, no accuracy loss.
- Sunrise/sunset shift across 1.11 km of longitude ≈ **4.4 seconds**. Below
  display resolution.

WeatherKit's underlying models are coarser than 785 m, so this is free.

### Interaction with Phase 1

Phase 1 cuts entries per location from 3 to 1. Phase 2 cuts the number of
locations. Together, the existing `MAX_ENTRIES = 2000` L1 cap goes from ~666
distinct points to 2,000 cells ≈ 2,400 km² of simultaneous coverage.

### Guards

- Bump the key prefix to `wk:v2:` so 3-decimal entries can't be read back under
  the new scheme. Matters once Phase 3 makes the cache survive restarts.
- `PRECISION` is read at module load; changing it requires a restart. That's an
  acceptable rollback path — set `WEATHER_CACHE_PRECISION=3` and redeploy to
  revert.

---

## Phase 3 — Two-tier cache, L2 in MongoDB

Today `ttlCache` is a process-local `Map`. Consequences:

1. Every deploy dumps the whole cache, so every active location re-fetches.
   At several deploys a day this is a real, recurring quota cost.
2. Two replicas would each keep their own cache, halving the hit rate.

### Why Mongo, not Redis

Mongoose is already connected, and there is an `expireAfterSeconds` precedent in
`models/OutfitHistory.ts:92`. Redis is technically better for this workload
(sub-millisecond, no write amplification) but adds a Railway service, a cost
line, and a new failure mode. Revisit if L2 latency shows up in traces.

### Design

- **L1** — the existing in-process `Map`, TTL shortened to **60 s**. Absorbs the
  hot path so repeat hits don't pay a Mongo round trip.
- **L2** — `weathercache` collection, TTL **30 min** (unchanged `DATA_TTL_MS`).

**`server/src/models/WeatherCache.ts`**

```ts
const weatherCacheSchema = new Schema({
  _id:       { type: String },                       // the cache key
  payload:   { type: Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });

weatherCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

Using the key as `_id` gives a free unique index and makes writes a single
atomic `updateOne(…, { upsert: true })`.

### Three rules

**1. Never trust the TTL index for correctness.** Mongo's TTL monitor runs on a
~60-second cycle, so documents can survive up to a minute past `expiresAt`.
Always compare `expiresAt` on read. The index exists only to reclaim disk.

**2. Fail open.** Wrap every L2 read and write in try/catch. Mongo unavailable
must degrade to "cache miss" and fall through to WeatherKit — never throw into
the request path. A failed write is a lost cache entry, not a failed request.

**3. Cache the normalised bundle, not the raw `WKResponse`.** Raw
`forecastHourly` is ~240 entries of ~20 fields; the normalised shape keeps 4.
That is an order of magnitude less document. Store
`{ current, hourly, daily }` in Ojo's shapes and let `getHourly(hours)` slice on
read as it already does.

The cost of rule 3: **any normaliser change must bump the key prefix**
(`wk:v2:` → `wk:v3:`). Put a comment on the prefix constant saying so.

### Read/write path

```
read:  L1 hit → return
       L2 hit (and not expired) → populate L1 → return
       miss → in-flight join, or upstream fetch
write: normalise → set L1 → upsert L2 (best effort)
```

### Write volume

One document per cell per 30 minutes — Phase 1 already cut this 3×. At 2,000
active cells that is ~4,000 upserts/hour. Negligible for Mongo.

### Adjacent, out of scope, worth knowing

If you ever scale past one replica:

- `express-rate-limit` is also in-memory — limits become per-instance.
- `node-cron` in `notificationService` fires on **every** replica, which would
  duplicate push notifications *and* duplicate the cron's WeatherKit calls.

Phase 3 makes the weather cache safe to scale out. Those two do not become safe
on their own.

---

## Phase 4 — Client-side freshness gate

The app currently re-fetches on **every** mount, no matter how fresh its own
cached snapshot is.

`src/lib/weatherCache.ts` already exports the gate for this:

```ts
/** True when a snapshot is older than `maxAgeMs` (or missing/unparseable). */
export const isStale = (snap, maxAgeMs = DEFAULT_MAX_AGE_MS): boolean => { … }
```

Nothing calls it. Grep across `src/` and `app/` returns only the definition — it
was written, documented, tuned to match the server TTL, and never wired up.

Two consequences today:

- `geocodeCity` returns a fresh object each call, so `setPlace` always gets a new
  reference and the `[place]` fetch effect always fires.
- `MainPage.tsx:93` uses `key={activeId}`, so every city switch remounts and
  re-fetches. Switching A → B → A re-fetches A even if A was fetched seconds ago.

### Honesty note: what this does and does not save

The quota effect is narrower than it first looks, because the **server** cache
already covers the sub-30-minute window.

| Situation | Without gate | With gate |
|---|---|---|
| Re-open 5 min later, server cache warm | 0 upstream | 0 upstream — **no quota saving**, saves a round trip |
| Re-open 45 min later, both caches stale | 1 upstream | 1 upstream — no saving |
| Re-open after a deploy, client fresh | **1 upstream** | **0 upstream** ✅ |
| City switch A → B → A, server warm | 0 upstream | 0 upstream — saves a round trip |

So a client gate **shorter than the server TTL saves almost no WeatherKit calls
in steady state.** Its quota value is specifically the *cold-server* window:
after a deploy, and for cells whose only user opens the app less often than the
TTL. Everything else it saves is your own hosting, latency, battery and mobile
data — all worth having, but not Apple quota.

A gate *longer* than the server TTL would save real quota, by trading freshness
for calls. That is a product decision, not an optimisation. **Recommendation:
keep the gate at 10 minutes** (comfortably inside the 30-minute server TTL) and
treat Phase 4 as a UX and hosting change that happens to close the post-deploy
hole. Phases 1 and 2 remain the quota levers.

### Implementation

**`src/components/WeatherHUD/WeatherHUD.tsx`**

```ts
const CLIENT_MAX_AGE_MS = 10 * 60_000;   // < DATA_TTL_MS on the server

// refreshKey only ever increments, so this is naturally sticky for the mount:
// once the user has pulled to refresh, the gate stays off until remount.
const mountRefreshKey = useRef(refreshKey);
const userRefreshed = refreshKey !== mountRefreshKey.current;
```

In the `[place]` fetch effect, before building the request:

```ts
useEffect(() => {
    if (!place) return;

    if (
        !userRefreshed &&
        seedSnapshot &&
        !isStale(seedSnapshot, CLIENT_MAX_AGE_MS) &&
        sameCell(seedSnapshot.place, place)
    ) {
        setLoading(false);        // seed already painted by the re-seed effect
        return;
    }

    /* …existing Promise.all fetch, unchanged… */
}, [place]);
```

Nothing else is needed on the skip path: the `[seedSnapshot]` re-seed effect has
already set weather, forecasts, daily, sunEvents, footerBg and lastUpdated, and
the existing `onReady` effect fires off `!loading`.

### Three traps

**1. The fetch effect runs twice on a warm mount.** `place` is seeded
synchronously from `seedSnapshot.place` (`WeatherHUD.tsx:162`), so the effect
fires once immediately — then `geocodeCity` resolves, `setPlace` gets a *new
object*, and it fires again. A "skip the first fetch" flag would gate run 1 and
let run 2 through, defeating the whole thing. **The gate must be evaluated on
every run**, which the formulation above does.

**2. GPS relocation.** For `CURRENT_LOCATION_ID` the seed is keyed by location
id, not coordinates. Fly from New York to Denver and the seed is fresh, the id is
still `current`, and the gate would happily serve New York's weather. Hence the
`sameCell` guard — reuse Phase 2's grid so client and server agree on what
"same place" means:

```ts
const sameCell = (a?: LocationCoords | null, b?: LocationCoords | null) =>
    !!a && !!b &&
    Math.round(a.lat * 100) === Math.round(b.lat * 100) &&
    Math.round(a.lon * 100) === Math.round(b.lon * 100);
```

On run 1 this is trivially true (`place` *is* the seed's place). On run 2 it
compares against freshly resolved GPS and correctly falls through to a fetch if
the user has moved.

**3. Pull-to-refresh must always bypass.** `refreshKey` changes without
remounting `WeatherHUD`, which is why `userRefreshed` is derived from a
mount-time ref rather than a boolean prop. If a user pulls to refresh and gets
cached data back, the gate is a bug rather than an optimisation.

### Blast radius

One file. `MainPage` is unchanged — it already passes `seedSnapshot` and
`refreshKey`. `weatherCache.ts` is unchanged; `isStale` finally gets called.

### Optional follow-on

`CLIENT_MAX_AGE_MS` is a natural candidate for a settings toggle later
("Reduce data usage" → 60 min), which *would* be a genuine quota lever. Out of
scope here; note it so the constant is not buried.

---

## Verification

There is no server test harness today (`server/package.json` has no `test`
script). Either add one, or verify manually against the Phase 0 counters.

| Check | Method | Pass |
|---|---|---|
| Bundling works | Cold-load main page | `upstream=1`, was 3 |
| Coalescing works | Fire `/current`, `/hourly`, `/daily` in parallel against an uncached cell | `upstream` +1, `coalesced` +2 |
| Snapping works | Two coordinates ~500 m apart | Second is a cache hit |
| Cron savings | Watch a `runMorningCheck` tick | 1 upstream per user, was 2 |
| L2 survives restart | Restart the process, re-request | `upstream` +0 |
| Fails open | Stop Mongo, request weather | 200 response, `upstream` +1 |
| Accuracy unaffected | Diff normalised output before/after snapping | Identical conditionCode, temp within rounding |
| Gate blocks warm mount | Background/foreground the app within 10 min | **Zero** network requests, not one |
| Gate survives the double-run | Same, watching the network log | Zero requests — not one late one after geocode |
| Refresh bypasses gate | Pull to refresh immediately after open | Request fires, `lastUpdated` resets |
| City switch A→B→A | Switch within 10 min | No re-fetch of A |
| GPS move falls through | Mock coords >1 km away | Re-fetches despite a fresh seed |

---

## Sequencing and expected effect

| Phase | Effort | Quota effect |
|---|---|---|
| 0 — instrumentation | Small | None — makes the rest measurable |
| 1a + 1b — bundle + coalesce | Small | **3× reduction**, largest single win |
| 2 — snap + coarsen | Trivial | Grows with user density; ~100× more cells shared |
| 3 — L2 cache | Medium | Removes per-deploy cache flush; unblocks scaling |
| 4 — client gate | Small | Narrow (cold-server window only); big hosting/UX win |
| 1c — bundle route | Small | None (latency + hosting only) |

Phases 1 and 2 are small and independent of everything else. If you only do two
things, do 1a+1b and 2.

Phases 3 and 4 both address the post-deploy cold window from opposite ends —
Phase 3 deterministically (the server cache survives), Phase 4 probabilistically
(fewer clients ask a cold server). They are complementary, not alternatives.
Phase 4 has no dependency on the server work and can ship at any point.

### Rough headroom

At an assumed 3 app opens/day with no cache sharing, per user per month:

| | Today | After 1 + 2 |
|---|---|---|
| App opens | ~270 | ~90 |
| Morning cron | ~60 | ~30 |
| Afternoon cron | ~30 | ~30 |
| **Total** | **~360** | **~150** |
| **Users on the 500k free tier** | **~1,390** | **~3,300** |

Estimates, sensitive to the opens/day assumption. The ratio is the reliable part.

Phase 4 is deliberately **not** in this table. At 3 well-spaced opens per day
every open already lands on an expired server cache, so a 10-minute client gate
changes none of these numbers. It pays off on bursty usage, city switching, and
the post-deploy window — none of which this model captures. Claiming a headroom
figure for it would be inventing one.
