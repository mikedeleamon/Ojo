# Zero-Catalog First Value — refined implementation spec

Revision of the original spec, corrected against the codebase as of `58fd0f0`.
The strategy is sound and the core insight holds. What follows changes the
*mechanics*, because several primitives the original assumes to exist do not,
and one requirement (`no account`) is far larger than the original costs it.

Read §1 before anything else — it changes the shape of the integration.

---

## Implementation status — 2026-08-26

**Scope changed after the first build.** The original premise — no account
required — was reversed: an account is now a prerequisite for using the app at
all. What survives is the part that made the premise worth having in the first
place: a signed-in user whose closet cannot produce an outfit still gets real,
weather-specific layering advice instead of an empty state.

| Phase | State |
|---|---|
| **0 — Guest** | **removed.** Anonymous device accounts, `/api/auth/anonymous`, `/claim`, `deviceIdHash`, the AuthGate branch and both UI affordances were built, verified end-to-end, then deleted. Recoverable from git history. |
| **1 — Model** | built, reduced. `src/lib/climate.ts` + `src/lib/archetypes/*` (49 archetypes). No persistence, no ownership tiers, no `matchArchetype`. |
| **2 — Cold start** | built, reduced. No onboarding closet grid. A text-only advice card replaces the empty state; the 29 glyphs now serve *photoless real garments* instead. |
| **3 — Containment** | moot by construction. Nothing is stored per user, so there is nothing to contain. |
| **4 — Enrichment** | **not applicable.** Promotion only means something with a stored closet. |
| **5 — Coverage** | not started. |

### What the feature is now

`buildGenericOutfit()` (`src/lib/archetypes/genericOutfit.ts`) selects the
garments a typical wardrobe in the user's climate band would hold, resolves them
to synthetic `ClothingArticle`s, and runs the *real* engine over them. The
result is rendered as prose — headline, layering advice, weather notes, and a
CTA — with no garment tiles, no score, no confidence figure and no
"Wore this today". Scoring or logging garments the user doesn't own would be a
number about nothing, and the wear log is training data for *their* taste.

The handoff is all-or-nothing: the moment the real closet can dress the user,
the generic path is never consulted. Nobody ever sees an assumed garment mixed
into suggestions built from clothes they actually own.

Nothing generic reaches the home-screen widget, the Morning Outfit Brief or the
Tomorrow Prep widget. Those keep their existing empty states — a push
notification about a hoodie the user doesn't own is a worse first impression
than silence.

### Decisions that still differ from the sections below

**The invariant survived, and it is still the release blocker.** §4.1 applies
unchanged: prevalence alone does not guarantee a wearable answer, because
`insufficient` fires *after* `isWeatherAppropriate` and gender filtering.
`__tests__/typicalWardrobe.test.ts` is exhaustive over band × bucket ×
wardrobe-gender, and enforces `top` + `bottom` + `footwear` rather than the
spec's "bottom *or* fullBody" — every fullBody archetype in the catalog is
gendered, so a `Men's` wardrobe could otherwise lose its only core coverage to
the engine's own filter.

**Three engine tables gained an `export` keyword.** `ROLE_MAP`,
`GARMENT_WARMTH_BASE` and `FABRIC_WARMTH_MOD` are exported so
`catalog.test.ts` validates against the real tables. §8 lists those files as
"not modified"; the alternative was hand-copying 16 type names into a test,
which is exactly the silent drift §2.2 warns about. No logic changed.

**Onboarding gained a Location step (step 2 of 6).** Not in the spec, but the
app has always needed coordinates and never asked for them: the OS prompt fired
implicitly on the first Home render — and, because that screen mounts behind the
login redirect, sometimes on top of the sign-in form. iOS grants one such prompt
per install. It is now spent deliberately, after an explanation, with manual
city search alongside rather than behind a "denied" branch.

**The glyph set was repointed.** `src/components/GarmentSilhouette.tsx` maps the
engine's `clothingType` vocabulary onto the 29 silhouettes, and any garment
without a photo — real or synthetic — draws one instead of the coat-hanger
placeholder, which read as a *failed image load*.

---

## 0. Baseline: what is actually implemented

| Original assumed | Reality |
|---|---|
| `src/engine/*` | `src/lib/*` — `layeringEngine.ts`, `outfitEngine.ts` |
| `src/types/archetype.ts` | One flat `src/types.ts`, plus co-located `src/lib/<area>/types.ts` |
| `src/engine/wearTimeline.ts` | **Does not exist.** Timeline is `buildTimeline()` inside `layeringEngine.ts:148` |
| `src/services/storage.ts` | `src/lib/storage.ts` (AsyncStorage + SecureStore) |
| `src/screens/onboarding/*` | `app/(auth)/onboarding.tsx` → `src/views/OnboardingPage/OnboardingPage.tsx` |
| `src/components/OutfitSuggestion.tsx` | `src/components/OutfitSuggestion/OutfitSuggestion.tsx` |
| `server/models/Closet.ts` | `server/src/models/Closet.ts` |
| `LayerClass` type | **Does not exist.** Closest is `OutfitRole` in `src/lib/outfit/types.ts:4` |
| `FabricType` type | **Does not exist.** `fabricType` is a bare `string` |
| `ClimateBand` type | **Does not exist.** `src/lib/geo.ts` is haversine only |
| Comfort model / `updateProfile` thermal prior | **Not implemented.** No comfort spec code exists |
| `foo.test.ts` siblings | Convention is `__tests__/*.test.ts`; jest `testMatch` is `.ts` only — **no `.tsx` component tests run** |

`tsc --noEmit` is clean on the current tree. That is the baseline to preserve.

---

## 1. The integration is a synthetic `ClothingArticle`, not a new `ResolvedGarment`

This is the single most important change.

The original proposes a `ResolvedGarment` shape and says engines should "consume
`ResolvedGarment[]`". But `generateOutfits()` (`src/lib/outfitEngine.ts:805`)
takes `ClothingArticle[]` and threads it through ~1100 lines: `roleOf()`,
`isWeatherAppropriate()`, `topNByFabric()`, `garmentWarmth()`, `pairHarmony()`,
`articleDisplayName()`, gender filtering, recency, preference profile. Switching
its input type is a rewrite of the whole engine, and `layeringEngine` on top of it.

Instead: **an archetype resolves to a `ClothingArticle`.**

```ts
// src/lib/archetypes/resolve.ts
export const archetypeToArticle = (a: GarmentArchetype): ClothingArticle => ({
  _id:          `arch:${a.id}`,        // namespaced — never collides with a Mongo ObjectId
  clothingType: a.clothingType,        // MUST be a key in ROLE_MAP + GARMENT_WARMTH_BASE
  name:         a.displayName,
  fabricType:   a.fabricHint,          // MUST be a key in FABRIC_WARMTH_MOD
  isAccessory:  a.isAccessory,
  // color, imageUrl, merchant, purchasePrice deliberately absent
});
```

Consequences, all good:

- **Zero engine changes.** `generateOutfits` and `generateLayeringRecommendation`
  compile and run untouched. The original's constraint — *"no engine module may
  branch on `OwnershipTier`"* — is satisfied by construction, not by discipline.
- Missing `color` degrades correctly: `pairHarmony` returns `0.7` for unknown
  colors (`src/lib/outfit/colorHarmony.ts:37`), so archetypes score neutrally
  rather than being penalised or crashing.
- Missing `imageUrl` already has a render path (`OutfitSuggestion.tsx:103`) —
  §5 replaces the fallback glyph there.
- The `arch:` id prefix is the tier lookup key. Everything downstream that keys
  on `_id` (outfit history, TripFit `articleIds`, recently-worn) keeps working;
  callers that must distinguish tiers do a prefix check at the boundary, not in
  the engine.

Keep the resolver pure. It is a map + filter, nothing more:

```ts
export function resolveCloset(
  real: ClothingArticle[],
  entries: ArchetypeEntry[],
  catalog: GarmentArchetype[],
): { articles: ClothingArticle[]; tierOf: (id: string) => OwnershipTier };
```

`tierOf` is the *only* thing the UI needs, and only for rendering and confidence.

---

## 2. Corrected data model

### 2.1 Warmth — reuse the existing scale, do not invent `insulationIndex`

The engine already has one warmth scale and the original's §3 correctly demands a
single source of truth — then violates it by adding a 1–8 index.

Existing, in `src/lib/outfitEngine.ts:93–136`:
- `GARMENT_WARMTH_BASE[clothingType]` → `0.00`–`0.88`
- `FABRIC_WARMTH_MOD[fabricType]` → `-0.05`–`+0.15`
- `garmentWarmth(article)` → clamped `0..1`
- `idealWarmthForFeelsLike(feelsLikeF)` → target on that same `0..1` scale

An archetype therefore does **not** carry a warmth number at all. It carries a
`clothingType` and a `fabricHint`, and `garmentWarmth()` computes the rest. If an
archetype needs a warmth the type/fabric pair cannot express (a light fleece vs. a
heavy fleece both being `Sweater`), add the new type to `GARMENT_WARMTH_BASE` —
that is the correct place, and it improves real items too.

The 1–8 banding survives only as a **derived presentation bucket** for the
coverage report (§4), computed as `Math.ceil(warmth * 8)`. Never stored.

### 2.2 `layerClass` → `OutfitRole`

There is no `LayerClass`. Layers are *derived* from role by
`extractLayers()` (`src/lib/layering/extractLayers.ts:8`): `top`/`fullBody` → base,
`midLayer` → mid, `outerwear` → outer. Archetypes must key on `OutfitRole` via
`clothingType`, or the app gets two competing taxonomies.

Practically: an archetype's `clothingType` must be a key in `ROLE_MAP`
(`src/lib/outfit/roles.ts:4`). Adding an archetype whose type is missing there is
a silent bug — it falls through to `'top'`. Assert this in a catalog test (§7).

### 2.3 `removability` is a number, not an enum

`removabilityOf()` (`layeringEngine.ts:66`) returns `0..1`, and the thresholds
that drive user-visible copy are `< 0.45` (mid) and `< 0.35` (outer). An enum of
`'trivial' | 'moderate' | 'awkward'` cannot feed those. Since `removabilityOf`
already derives from `clothingType` + `fabricType`, the synthetic article gets
correct removability for free — **drop the field from the archetype entirely.**

### 2.4 Drop `properties: { waterproof, windproof, breathable }`

No consumer exists. Rain handling is `RAIN_RESILIENCE`, keyed on fabric string
(`outfitEngine.ts:169`); wind is the NWS wind-chill formula on weather, not on
garments. Adding these booleans means either wiring them into `fabricScore` — a
scoring change the original doesn't scope, with its own regression risk — or
shipping three dead fields on 45 records. Waterproofness comes from `fabricHint`
(`Synthetic` → 0.85 resilience) today. If shell modelling needs to improve, that
is a separate, deliberate change to `fabricScore`.

### 2.5 Resulting archetype shape

```ts
// src/lib/archetypes/types.ts
export type OwnershipTier = 'assumed' | 'confirmed' | 'owned';

export interface GarmentArchetype {
  id:           string;   // 'mid_fleece_light'
  displayName:  string;   // "Light fleece"
  clothingType: string;   // MUST be a ROLE_MAP + GARMENT_WARMTH_BASE key
  fabricHint:   string;   // MUST be a FABRIC_WARMTH_MOD key
  isAccessory:  boolean;
  bodyZone?:    BodyZone; // accessories only — feeds zoneOf()
  prevalence:   Record<ClimateBand, number>;
  commonality:  number;   // onboarding grid rank
  glyph:        GlyphKey; // union of implemented glyph components, not `string`
}

/** Device-local. Never synced, never part of a named Closet. */
export interface ArchetypeEntry {
  archetypeId:  string;
  tier:         'assumed' | 'confirmed';
  confirmedAt?: string;
  createdAt:    string;
  schemaVersion: 1;
}
```

Note what changed: there is no unified `ClosetEntry` spanning all three tiers.
See §2.6.

### 2.6 `owned` items stay `ClothingArticle` — do not unify the storage model

The original's `ClosetEntry` puts assumed, confirmed, and owned in one list with
`archetypeId` always set. That is elegant on paper and expensive here, because
the app's model is **Closet → articles**, and `closetId` is load-bearing across
TripFit (`SavedTripFitPlan.closetId`), outfit history (`OutfitHistoryEntry.closetId`),
Trip Mode, insights, price backfill, and the donation queue. A flat entry list
has no closet to belong to.

So:

- **`owned`** = a real `ClothingArticle` in a server Closet. Unchanged.
- **`assumed` / `confirmed`** = `ArchetypeEntry[]` in AsyncStorage, device-local,
  not in any Closet.
- The resolver merges them at read time for the engine only.

Archetype entries must **not** appear in the Closet tab, item counts, insights,
price backfill, donation flows, or recap. They are recommendation inputs, not
possessions the user curated. Auditing every consumer of `closet.articles` for
this is real work — budget for it (§6, Phase 3).

Promotion is then not an in-place field update but: user adds a real article →
`matchArchetype()` finds the corresponding `ArchetypeEntry` → that entry is
deleted. The archetype stops being needed because the real thing exists. Same
outcome, no migration, no duplicate suppression logic in the engine.

### 2.7 `ClimateBand` must be built

Nothing derives climate from coordinates. Add `src/lib/climate.ts`:

```ts
export type ClimateBand = 'tropical' | 'arid' | 'temperate' | 'continental' | 'polar';
export const climateBandFor = (lat: number, lon: number): ClimateBand;
```

Latitude-banded with a small hand-tuned override table is sufficient and keeps
it a pure function with no network dependency — important, because it runs before
the first weather fetch. Do not fetch a climate API for this.

---

## 3. The account-free requirement is a separate workstream — and it is the blocker

The original lists this as an edit to `src/screens/onboarding/*`. It is not.
Four independent things currently make a no-account first run impossible:

1. **Routing.** `AuthGate` (`app/_layout.tsx:66`) redirects any user without a
   token to `/(auth)/login`. Nothing in the app is reachable.
2. **Onboarding trigger.** Onboarding runs only when `markOnboardingPending()`
   was set — and that is called exclusively on *new account creation*
   (`src/lib/onboarding.ts:51`, called from SignupPage/LoginPage). Onboarding
   cannot run before an account exists.
3. **Closets are server-only.** `useClosets` does
   `axios.get('/api/closets', auth())` (`src/hooks/useClosets.ts:104`). There is
   no local closet store of any kind.
4. **Weather requires auth.** `server/src/routes/weather.ts:7` is
   `router.use(requireAuth)`. A guest cannot fetch the weather that the entire
   recommendation is computed from.

(4) is decisive. "60 seconds to a personalised layering recommendation" is
impossible without weather, and weather is behind a login wall.

### Recommended approach: anonymous device account

Server issues a token for a device-generated ID — no email, no password, no user
input. The guest gets a real `userId`, so closets, weather, history, and
notifications all work through the existing code paths unchanged. A later
"create an account" claims the same `userId` and keeps everything.

- `POST /api/auth/anonymous` → `{ deviceId }` → `{ token, user }`
- `User` model: `isAnonymous: boolean`, `deviceId?: string` (sparse unique index)
- Claim flow: `POST /api/auth/claim` attaches email/password to the current
  anonymous user rather than creating a new one
- `AuthGate` change is one branch: no token → mint anonymous → proceed
- Rate-limit `/api/auth/anonymous` per IP; it is an unauthenticated
  account-creation endpoint and it fans out to WeatherKit calls
  (see `docs/weatherkit-cost-plan.md` — anonymous users are new billable load
  and that plan's assumptions need revisiting before this ships)

The rejected alternative — true local-only guest mode — requires a local closet
store, an unauthenticated weather endpoint, and a merge-on-signup path. More
surface, more cost exposure, two code paths for closets. Not worth it.

**This work must be scheduled before the archetype UI, not alongside it.**
Archetypes without it deliver a better cold start *for users who already signed up*,
which is not the feature.

---

## 4. Corrections to onboarding, coverage, and empty states

### 4.1 The reachable empty state is `insufficient`, not `empty_closet`

`generateOutfits` has **two** empty exits:
- `articles.length === 0` → `empty_closet` (`outfitEngine.ts:829`)
- `!hasCoreTopBottom && !hasFullBody` → `insufficient` (`outfitEngine.ts:864`)

The second fires *after* weather filtering (`isWeatherAppropriate`) and gender
filtering. So a prevalence ≥ 0.7 seed does **not** guarantee a recommendation —
seed a tropical band with only tops and the skip-through path lands on
`insufficient`, which is precisely the empty state this feature exists to remove.

Replace the prevalence rule with a hard invariant:

> For every `ClimateBand`, and for every `WeatherBucket`, the seeded set must
> survive `isWeatherAppropriate` filtering with at least one `top` **and** one
> `bottom` (or one `fullBody`), plus one `footwear`.

Prevalence ≥ 0.7 is the *starting* selection; the invariant is then enforced by
back-filling the highest-prevalence missing role. Test this exhaustively as
band × bucket — it is the release-blocking assertion, and it is cheap.

### 4.2 Onboarding ordering conflicts with the existing flow

Current `OnboardingPage` is five steps: Welcome → **Name your first closet** →
Preferences → **Notifications** → All set. The original's §4.1 mentions neither
the closet-naming step (which creates the server Closet that everything else
keys on) nor what happens to the notifications step it says must not appear.

Revised first run:

1. Location permission, with manual city entry always offered
2. Climate inference (pure, no network)
3. Comfort question — **cut from v1.** There is no comfort model to feed it
   (`updateProfile` does not exist). Asking a question whose answer nothing reads
   is worse than not asking. Re-add with the comfort spec.
4. Closet grid (§4.3), skippable
5. Recommendation

The closet-naming step moves to first real-article add ("Where should this go?"),
defaulting to an auto-created closet so it can be skipped entirely. Notifications
move to a post-value prompt — after the user has seen at least one recommendation.
Neither step is deleted; both are relocated behind first value.

### 4.3 `enrichmentScore` has no data source as defined

Defined as "share of *recently recommended* garments at tier `owned`". Nothing
logs what was recommended. What *is* logged, on `OutfitHistoryEntry`, is what was
**worn** (`articleIds`) and what was shown-but-not-worn (`negatives`, added
2026-07) — and only on days the user logged an outfit.

Define it over the wear log instead, which exists today:

```ts
enrichmentScore = share of article ids in the last 30 days of
                  OutfitHistoryEntry.articleIds that are NOT `arch:`-prefixed
```

This preserves the original's actual intent — weight by what the user really
wears, not by catalog size — using data already being collected. If true
recommendation-frequency weighting is wanted later, that needs a new log and
should be scoped separately.

### 4.4 `matchArchetype` maps a `GarmentType`, not a `ClothingArticle`

The classifier emits `GarmentType` — a 34-member lowercase union
(`src/services/clothingIdentifier.types.ts:3`: `'t-shirt' | 'hoodie' | 'puffer' | …`),
which is a *different vocabulary* from the title-case `clothingType` strings the
engine uses (`'T-Shirt'`, `'Hoodie'`, `'Coat'`). There is no `'puffer'` in
`ROLE_MAP` or `GARMENT_WARMTH_BASE`.

So `matchArchetype` is mostly a static `GarmentType → archetypeId` table plus a
fabric tie-break, not a scoring function. Write it as a table — it is exhaustive,
checkable at compile time, and 34 entries.

The original's ambiguity rule ("prefer the archetype the user already confirmed")
is right and should be kept as the tie-break.

---

## 5. Rendering

The original's warning is correct and the current code is the exact failure mode
it describes: when `imageUrl` is absent, `OutfitSuggestion.tsx:112` renders a
muted `HangerIcon` — a grey placeholder that reads as a missing photo.

There is no garment illustration system. `src/components/icons/` holds eight
app-chrome icons (camera, gear, suitcase…). **~45 archetype glyphs is a real
design deliverable**, not a `glyph: string` field. Scope it explicitly:

- Build glyphs as React Native SVG components following the existing
  `WeatherIcons/` pattern — that directory is the closest precedent for a themed
  illustration set inside the glass system
- Type `glyph` as a union of implemented component keys so an archetype cannot
  reference a glyph that doesn't exist
- One shared `<ArchetypeGlyph>` wrapper carries the treatment (fill, stroke
  weight, container) so tier is never legible as visual rank
- Reuse `GlassCard` and the existing `articleCard` container so a photographed
  jacket and an illustrated fleece sit in identical frames

Component tests will not run — jest `testMatch` is `.ts` only. Glyph coverage is
asserted in a `.ts` catalog test (every `glyph` key resolves to an exported
component), not a render test.

---

## 6. Revised phases

| Phase | Scope | Why here |
|---|---|---|
| **0 — Guest** | Anonymous device account, `AuthGate` branch, claim flow, rate limiting, WeatherKit cost review | Nothing else delivers the promise without it |
| **1 — Model** | `ClimateBand`, archetype types + catalog, `archetypeToArticle`, resolver, seeding with the band × bucket invariant, unit tests | Pure, testable, no UI |
| **2 — Cold start** | Onboarding reorder, closet grid, glyph set, `ArchetypeGlyph` in `OutfitSuggestion`, tier confidence multiplier, instrumentation | The shippable feature |
| **3 — Containment** | Audit every `closet.articles` consumer so archetype entries stay out of counts, insights, price backfill, donation, recap | Prevents the feature leaking into surfaces it would corrupt |
| **4 — Enrichment** | Contextual prompts, `matchArchetype` promotion | v1.1 |
| **5 — Coverage** | Coverage report UI; folds into `wardrobeGaps.ts`, which already does gap tracking on a 30-day window | v1.2 |

Phase 3 is new and non-optional. Phase 0 is the original's unlisted dependency.
The comfort question is deferred to the comfort spec.

---

## 7. Tests

Convention is `__tests__/*.test.ts`. Add:

`src/lib/archetypes/__tests__/catalog.test.ts` — the catalog is data, so validate it:
- every `clothingType` is a key in `ROLE_MAP`
- every `clothingType` is a key in `GARMENT_WARMTH_BASE`
- every `fabricHint` is a key in `FABRIC_WARMTH_MOD`
- every `glyph` resolves to an exported component
- ids are unique; `prevalence` covers all bands

`src/lib/archetypes/__tests__/seed.test.ts` — **the release blocker:**
- for every `ClimateBand` × `WeatherBucket`, the seeded set passes
  `generateOutfits` with `status === 'ok'` (not just non-empty)
- Phoenix does not get a parka; Oslo does

`src/lib/archetypes/__tests__/resolve.test.ts`:
- pure-`assumed` closet produces a valid `OutfitResult`
- `arch:` ids never collide with real article ids
- tier multipliers apply to confidence
- promoting an archetype to a real article never lowers confidence (monotonicity)

`src/lib/archetypes/__tests__/match.test.ts`:
- all 34 `GarmentType` values map to a real archetype id
- matching removes the archetype entry rather than leaving a duplicate

Existing engine test suites (`src/lib/outfit/__tests__`, `src/lib/layering/__tests__`)
must pass unchanged — under §1 the engines are not modified, so any failure there
means the synthetic-article shape is wrong.

---

## 8. Corrected file map

**New**
```
src/lib/climate.ts
src/lib/archetypes/types.ts
src/lib/archetypes/catalog.ts          # typed module, not JSON — compile-time checked
src/lib/archetypes/resolve.ts
src/lib/archetypes/seed.ts
src/lib/archetypes/match.ts
src/lib/archetypes/storage.ts
src/lib/archetypes/__tests__/*.test.ts
src/components/icons/garments/*.tsx    # ~45 glyphs, WeatherIcons pattern
src/components/ArchetypeGlyph.tsx
src/views/OnboardingPage/ClosetGrid.tsx
server/src/routes/auth.ts              # + /anonymous, /claim
```

**Modified**
```
app/_layout.tsx                                     # AuthGate guest branch
src/lib/onboarding.ts                               # decouple from signup
src/views/OnboardingPage/OnboardingPage.tsx         # reorder, add grid
src/components/OutfitSuggestion/OutfitSuggestion.tsx # glyph vs photo (line ~103)
src/hooks/useClosets.ts                             # merge archetype entries at read
server/src/models/User.ts                           # isAnonymous, deviceId
```

**Not modified — deliberately**
```
src/lib/outfitEngine.ts
src/lib/layeringEngine.ts
src/lib/outfit/*
src/lib/layering/*
server/src/models/Closet.ts
```

The original proposed adding `tier` + `archetypeId` to the Closet schema. Under
§2.6 that is unnecessary — archetype entries never reach the server. If it is
ever added, note that `server/src/routes/closets.ts` **whitelists** article fields
on write; a schema field added without the matching whitelist entry is silently
dropped (this already bit `detectedGarmentType` — see the comment at
`server/src/models/Closet.ts:20`).

---

## 9. What did not change

The strategy. Layering advice genuinely does not need item identity; the engine's
`garmentWarmth` is already computed from type + fabric alone, which is exactly the
information an archetype carries. Making the closet enrichment rather than a
prerequisite is the right inversion, the tier model is the right abstraction, and
the discipline around enrichment prompts (contextual only, capped, never gating)
should be kept verbatim.

The honest-confidence line — *"Based on typical wardrobes for your area — add what
you own to sharpen this"* — should also be kept verbatim. It is doing exactly the
work the original claims.
