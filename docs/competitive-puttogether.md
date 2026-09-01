# Competitive Analysis — Ojo vs. PutTogether

**Date:** 2026-08-16
**Competitor:** AI Outfit Planner: PutTogether (APROBEE TECHNOLOGY PTE. LTD., Singapore)
**Sources:** App Store listing `id6761279096`, puttogether.world, their "wake up already dressed" guide
**Ojo baseline:** commit `58fd0f0`, verified against the working tree

---

## 0. The one-line read

PutTogether is a **beautifully packaged, aggressively monetized, well-distributed shallow product**.
Ojo is a **deep engineering product with no packaging, no monetization, and no distribution.**

The gap between you is not features. You are ahead on features. The gap is that they
ship, charge, and get found — and you do none of those three yet. Everything in §5 is
ordered by that reality.

---

## 1. Head-to-head

| Dimension | Ojo | PutTogether | Edge |
|---|---|---|---|
| **Platforms** | iOS + Android (`android/` exists, Expo cross-platform) | iOS only (+ M1 Mac) | **Ojo** |
| **Weather source** | Apple WeatherKit (`server/src/lib/weatherKit.ts`) | Open-Meteo / ECMWF | Even (see §4.3) |
| **Weather reasoning** | NWS wind-chill formula, layer-necessity scoring, day-range derivation from hourly forecast, removability scoring, morning/afternoon/evening timeline, 0–1 confidence score (`layeringEngine.ts`) | Humidex >27°C, wind chill <10°C, rain thresholds at 40%/50%, AM/PM split at >8°C swing | **Ojo** — theirs is a threshold table, yours is a scoring model |
| **Garment recognition** | On-device TFLite MobileNetV3-Large, 34 garment + 4 sleeve classes; iOS Vision `VNGenerateForegroundInstanceMaskRequest` background removal shipped (`modules/ojo-vision-bridge/`) | Server-side AI detection → watercolor illustration | **Ojo on cost & privacy**, **PutTogether on output beauty** |
| **Marginal cost per garment** | ~zero (on-device inference) | Real (server AI + illustration) — which is why they meter it | **Ojo — structurally** |
| **Visual identity** | Glassmorphism, DMSerifDisplay + Outfit, weather-driven animated gradients, custom weather icon set | Hand-painted watercolor stickers + watercolor avatar | **PutTogether** |
| **Avatar / try-on** | None | Watercolor avatar from full-body photo | **PutTogether** |
| **Calendar awareness** | None (occasion chips are manual) | Reads calendar for occasion | **PutTogether** |
| **Trip / travel** | TripFit planner, Trip Mode auto-surfacing, **Gmail airline-confirmation parsing** (`server/src/lib/gmailParser.ts`), trip countdown widget with arrival-day weather peek + forecast drift | 100 hand-written city capsule guides (content, not product) | **Ojo — by a mile** |
| **Home screen widgets** | 5 built: Today's Outfit, Trip Countdown, Tomorrow Prep (6 PM flip), Layer Timeline, UV & Sunset, + Lock Screen accessories | None advertised | **Ojo** |
| **Push intelligence** | Morning Outfit Brief naming actual garments from your closet (`morningBrief.ts` + `dayOutfit.ts`) | 7 a.m. outfit for a pre-set occasion | **Ojo (marginally)** |
| **Wardrobe analytics** | Insights engine, wardrobe gap detection, cost-per-wear/price backfill, sleeping-items detection, Style DNA derived from real outfit history | "Style Diary" — AI-written observations; Style DNA from an 8-question quiz | **Ojo on substance, PutTogether on delivery** |
| **Style archetypes** | Derived from behavior (`userPreferences.ts` → `derivePreferenceProfile`) | 25 named archetypes ("Quiet Sculptor", "Western Romantic") tied to films/designers | **PutTogether on naming/shareability** |
| **Recap / shareable moment** | Weekly Recap engine + 1080×1920 story card, IG Stories share cards | Share-ready video exports with avatar + weather | Even — **but theirs ships and yours 404s** |
| **Monetization** | **None. Zero lines of paywall code.** | 4 tiers: $9.99 / $16.99 / $25.99 / $34.99 mo + $1.99–$19.99 credits | **PutTogether** |
| **Distribution** | None — no site, no SEO, not listed | SEO content engine, self-favoring "best apps" roundups, 100 city guides | **PutTogether** |
| **Social proof** | None | 5.0 ★ from 18 ratings | **PutTogether (thin — see §3)** |
| **Test coverage** | 29 test suites over the engines | Unknown | **Ojo** |
| **App size** | Not measured | 172.9 MB | Likely **Ojo** |

---

## 2. SWOT — Ojo

### Strengths
1. **A real reasoning engine, not a lookup table.** `layeringEngine.ts` computes NWS wind
   chill, scores layer necessity against effective temperature, derives the true day range
   from hourly data, scores how removable each layer is, and emits a confidence value.
   `outfitEngine.ts` is 1,121 lines of role mapping, color harmony, seasonality, weather
   bucketing, gender filtering, recency, and preference weighting. This is a genuine
   technical moat that a 4-person app studio cannot casually replicate.
2. **On-device ML = structurally lower marginal cost.** Their pricing exists because their
   pipeline costs money per garment. Yours doesn't. This is the single most exploitable
   asymmetry in the whole comparison (§5.1).
3. **Travel is a category you already own.** Gmail airline-confirmation parsing → auto trip
   creation → TripFit packing → Trip Mode → countdown widget with forecast drift. They
   answered travel with blog posts. You answered it with software.
4. **Widget surface area.** Five widgets plus Lock Screen accessories. A widget is a daily
   unpaid impression, the cheapest retention mechanism on iOS, and the highest-intent
   surface for exactly your use case.
5. **Cross-platform.** Android is fully cut off from them. That's roughly half the addressable
   market, uncontested by this competitor.
6. **Privacy posture as a product claim.** Classification happens on-device; photos need
   never leave the phone for the core loop. Their privacy label lists photos/videos and
   location as *linked to identity*.
7. **Behavioral Style DNA beats quiz Style DNA.** Theirs is 8 questions answered once.
   Yours is derived from what you actually wore. Yours gets *more* right over time; theirs
   is frozen at signup.
8. **Engineering discipline.** Pure functions, co-located types, 29 test suites, `tsc --noEmit`
   clean. Velocity later comes from this.

### Weaknesses
1. **Not shipped.** Three years, 226 commits, `eas.json` production submit block configured —
   and no listing. Every strength above is currently worth zero.
2. **No monetization code at all.** Not a pricing decision left unmade — *no infrastructure*.
   No RevenueCat, no StoreKit, no paywall, no entitlement gate. This is weeks of work you
   haven't started while a competitor charges $34.99/mo.
3. **No distribution surface.** No marketing site, no content, no SEO, no App Store listing to
   rank. They have a domain ranking for "AI outfit app weather."
4. **Cold start is brutal and unsolved.** Value requires a photographed closet. The fix
   (`docs/zero-catalog-first-value.md`) is spec-only, and its Phase 0 spends your WeatherKit
   quota headroom. PutTogether gets you to an illustrated portrait *before* the paywall —
   they solved perceived time-to-value with a party trick and it works.
5. **Classifier accuracy is a soft spot.** 56.3% val accuracy on 34 classes. The
   MobileViT-Small + FashionCLIP distillation targeting 65–70% is in progress, not landed.
   Misclassified garments are the most visible possible failure in this product.
6. **Ojo's output isn't screenshot-bait.** Their watercolor sticker is *inherently* shareable;
   a person will post it unprompted. That's free acquisition you don't have.
7. **Known broken/blocked items:** IG Story `/s/*` link sticker 404s (hosting), Google OAuth
   pending manual setup, Weekly Recap unverified on device, three new widgets unverified on
   device, `expo prebuild` broken.
8. **No calendar integration.** Occasion is manual. Theirs is automatic.
9. **Scope sprawl risk.** B2B licensing plan, barcode scanning, Android ML Kit, CoreML,
   zero-catalog, widget redesign — all open. None of it is "get it in front of a human."

### Opportunities
1. **Undercut their metered model with an unmetered one.** "$9.99/mo for 25 garments" is an
   attackable price. On-device inference lets you say *unlimited closet, always*.
2. **Android is empty.** Ship there first if iOS review or ASO is a bottleneck — zero
   competition from them.
3. **Their content strategy is copyable and their moat is thin.** Their SEO advantage is
   ~a dozen guides. Your engine can *generate* city-specific climate capsules the way they
   hand-write them — and yours would be current, not "updated for the month."
4. **Widget-first positioning is unclaimed.** "The outfit app you never open" is a real,
   differentiated, demo-able wedge nobody in this category is running.
5. **Travel as the beachhead.** Gmail → trip → packing list is a sharper, higher-willingness-
   to-pay wedge than "what do I wear today," and you're the only one with it.
6. **B2B/SDK licensing.** Their engine cannot be licensed — it's a styling aesthetic. Yours is
   a deterministic, testable, pure-function layering engine. Genuinely licensable.
7. **The accuracy/honesty angle.** They claim things a daily forecast cannot support. Your
   `dayOutfit.ts` explicitly refuses to imply it knows tomorrow's wind. "We don't make up
   weather" is a defensible marketing position in a category full of hand-waving.

### Threats
1. **They ship 4× faster than you.** v1.9 with a "Dress me for…" feature added in one cycle.
   Aprobee is a studio that ships fast and iterates; every month you don't launch, they
   close feature gaps and bank reviews.
2. **They'll add layering.** Wind chill and humidex are already in their marketing. Adding a
   layer timeline is a sprint for them. Your engine advantage has a shelf life.
3. **Category is crowded and consolidating.** Pureple, Indyx, Nouva, GetWardrobe, Pronti,
   ALTA, Lekondo. Late entry into a crowded category with no differentiated distribution is
   the default failure mode here.
4. **Apple WeatherKit cost.** Your own `docs/weatherkit-cost-plan.md` exists because this is a
   real per-call cost. Open-Meteo is free. At scale their unit economics on weather beat yours.
5. **Aesthetic beats accuracy in consumer fashion.** Uncomfortable truth: the watercolor
   avatar may simply matter more to buyers than a correct wind-chill calculation.
6. **Three years of sunk cost with no market feedback** means some fraction of what you built
   is answering questions no user asked.

---

## 3. SWOT — PutTogether

### Strengths
- **Distinctive, ownable visual identity.** Watercolor illustration is instantly recognizable
  and impossible to confuse with the generic-grid look of every other closet app.
- **Built-in shareability.** The avatar and sticker closet are the product *and* the ad.
- **Monetization from day one**, at four price points, with a credits layer on top. They are
  learning their price curve while you have no curve.
- **Content/SEO machine.** 100 city capsule guides, style guides, and — notably — a "best
  outfit apps" roundup on their own domain that ranks themselves first on a criterion they
  chose. Effective, if not honest.
- **Sharp onboarding hook.** Illustrated portrait *before* the paywall. Sunk-cost + delight,
  then the ask. Textbook.
- **Named archetypes.** "Quiet Sculptor," "Western Romantic," tied to films and designers.
  Quiz results get screenshotted and posted. Yours don't have names.
- **Calendar integration** — occasion without user effort.
- **Studio operating model.** Aprobee also ships Luminora and "Do I?". They have a repeatable
  launch playbook.
- **Free weather at ECMWF quality.** Open-Meteo is genuinely good and genuinely free.

### Weaknesses
- **Extremely thin social proof.** 5.0 ★ from **18 ratings**. That is not product-market fit;
  that's friends, family, and possibly incentivized reviews. A 5.0 with n=18 is a *weakness*
  signal — real apps regress to 4.3–4.7 immediately.
- **Punishing price ladder.** $9.99/mo for 25 garments. The average closet is several hundred
  items. To actually digitize a wardrobe you're pushed to $25.99–$34.99/mo — more than
  Netflix, for outfit suggestions. This is the softest target in their entire business.
- **Credits on top of subscription.** Users hate metered consumables in a subscription. This
  will show up in reviews as soon as n>100.
- **iOS only, English only.** No Android, no localization.
- **No widgets.** Requires opening the app — the highest-friction possible daily loop.
- **172.9 MB** install size.
- **Shallow weather logic.** Fixed thresholds (40% rain, 8°C swing) with no notion of layer
  removability, no confidence, no per-garment fabric reasoning.
- **Server-side pipeline = cost floor.** Every garment costs them money forever. They can
  never compete on "unlimited."
- **Illustration is lossy.** A watercolor sticker abstracts away the actual garment — worse
  for accurate outfit judgment than a real cutout, and cannot support try-on later.
- **No travel product**, no trip detection, no packing.
- **Frozen Style DNA.** 8 questions at signup, never learns.
- **Marketing claims are fragile.** The "8 to 12% better precipitation accuracy" cite is doing
  a lot of load-bearing work for a claim about outfit quality.

### Opportunities (theirs)
- Android and localization are wide open to them.
- Adding widgets is straightforward and would close your biggest retention edge.
- Brand/retail partnerships fit their aesthetic naturally.
- Their illustration style could extend to shopping, gifting, editorial.

### Threats (theirs)
- **The credit model is their fault line.** One well-positioned free-unlimited competitor
  (you) reframes their pricing as gouging.
- Illustration cost scales linearly with users; a viral moment could be financially painful.
- On-device ML commoditizing makes their server pipeline a liability, not a feature.
- Apple shipping anything native in this space.
- Studio attention — they have three apps; if this one plateaus, they move on.

---

## 4. Where they genuinely beat you (don't rationalize these)

**4.1 Time-to-delight.** Their user sees a beautiful illustrated version of themselves in
~4 minutes. Yours sees an empty closet and a camera prompt. This is the difference between
a product people talk about and one they abandon on day one. Your `zero-catalog-first-value`
spec knows this; it's still a spec.

**4.2 The output is the marketing.** Every PutTogether user who posts their avatar is a free
ad. Nothing Ojo renders today makes someone want to post it. The Weekly Recap card is your
closest analogue and it's unverified and its link sticker 404s.

**4.3 Weather source economics.** WeatherKit costs you per call and you have a cost-reduction
plan in flight because of it. Open-Meteo is free at ECMWF quality. On *forecast quality* it's
a wash; on *unit economics* they win. Worth revisiting whether Open-Meteo should be your
fallback tier — it would collapse the WeatherKit cost problem entirely.

**4.4 They have prices and you don't.** They're learning what people pay. You will start that
learning from zero on launch day, months behind.

**4.5 Naming things.** "Quiet Sculptor" is better product design than a correct preference
vector. Your Style DNA is smarter and completely unmemorable.

---

## 5. How to make Ojo superior

Ordered by leverage, not by effort.

### 5.1 Weaponize the on-device cost asymmetry — *this is the whole strategy*

Their entire pricing exists because server-side illustration costs money per garment.
Yours costs nothing. So make the pricing page the attack:

> **Unlimited closet. Always. Because the AI runs on your phone, not our servers.**

Concretely:
- **Free tier: unlimited garments.** Never gate closet size. Ever. This makes their $9.99/25-item
  tier read as extortion the moment anyone compares.
- Monetize on *depth*, not *volume*: trip planning + Gmail auto-detection, layering timeline,
  widgets beyond the first, Weekly Recap, insights/cost-per-wear. Those cost you nothing
  per-unit either, but they're worth paying for.
- Target **$4.99–$7.99/mo or ~$39/yr** — deliberately below their entry tier while offering more.
- Put a comparison table on your site with "garments included: unlimited" against their
  "25 / 100 / …". Let their own pricing do the work.

### 5.2 Solve time-to-delight before you solve anything else

You cannot out-ship them from behind an empty-closet wall. Finish
`docs/zero-catalog-first-value.md` — but scope it to the *minimum* that produces a real
recommendation in under 60 seconds with zero photos, via the archetype closet. Then:

- **Steal their pre-paywall delight beat.** Their portrait-before-paywall is the mechanic to
  copy (not the watercolor). Yours should be: *location + 3 taps → a real, weather-correct
  outfit with a layering timeline, before signup.* Your engine can already do this; it's
  gated behind a closet you don't need to have.
- **First-run "wow" should be the timeline**, not the closet. "Light jacket at 7am, shed it by
  11, you'll want it again after 6" — with a rendered arc — is a thing nobody else shows and
  it needs no wardrobe at all.

### 5.3 Make one thing screenshot-bait

Pick exactly one and make it genuinely beautiful — not "nice," *postable*:

- **Best candidate: the Layer Timeline card.** A day-arc of temperature with your garments
  placed along it, in your gradient/glass aesthetic. It's uniquely yours, it's information-
  dense (which reads as smart), and it's visually distinct from every grid-of-clothes
  competitor.
- Second: finish the Weekly Recap 1080×1920 card and **unblock the `/s/*` hosting 404** — that
  bug is currently killing your only viral loop.
- Give your Style DNA archetypes **names and art**. "Quiet Sculptor" works because it's a
  identity people claim. Derive yours from behavior (still smarter than a quiz) but *name*
  the result. This is maybe 2 days of work for a permanent shareability upgrade.

### 5.4 Own travel — it's a category, not a feature

Nobody else has Gmail → trip → packing. Make it the headline, not a settings screen.

- Position as: **"Ojo packs for you."** Forward a flight confirmation, get a weather-correct
  packing list from your actual closet, plus a countdown widget that warns you when the
  forecast drifts.
- This is a **higher-willingness-to-pay** wedge than daily outfits and a much easier PR/ASO
  story ("the app that reads your flight emails and packs your bag").
- It's also the hardest thing on this list for them to copy — it needs OAuth, email parsing,
  and a server.

### 5.5 Run widget-first positioning

"The outfit app you never have to open." Five widgets + Lock Screen accessories is a real,
demo-able, unclaimed position — and it's the cheapest retention mechanism that exists on iOS.
Get the three unverified widgets on-device and verified, then lead with them in screenshots.
App Store screenshot #1 should be a home screen, not an app screen.

### 5.6 Take Android uncontested

They physically cannot compete there. You have an `android/` directory already. Even a
mediocre Android launch gets you an entire market with zero head-to-head. It's also where
widget culture is strongest.

### 5.7 Turn the engine into content (beat them at their own game)

They hand-write 100 city capsule guides "updated for the month." You have an engine that can
*compute* those, correctly, for any city, continuously. A programmatic-SEO surface —
`ojo/packing/lisbon-in-october`, generated from real climate normals and your layering
engine — outranks hand-written pages on coverage and freshness simultaneously. This is the
one place where three years of engineering converts directly into distribution.

### 5.8 Make accuracy a brand, since you actually have it

They imply their app knows tomorrow's wind. Your `dayOutfit.ts` explicitly refuses to.
Publish that. "We show a confidence score. We tell you when we don't know." In a category
of AI hand-waving, honest uncertainty is a differentiator that also happens to be true —
and it's already implemented (`layeringEngine`'s 0–1 confidence).

### 5.9 Fix the two things that would embarrass you at launch

- **Classifier accuracy (56.3%).** Land the MobileViT/FashionCLIP upgrade, or ship a
  frictionless correction UI so a wrong guess is a one-tap fix rather than a bad review.
  Given the segmentation work already shipped, accuracy should be measurably better than
  56.3% now — **re-measure before deciding**, you may already be at target.
- **The `/s/*` 404.** Your only viral loop is broken.

### 5.10 Add the two cheap things they have and you don't

- **Calendar read** for automatic occasion. Small, high-perceived-intelligence.
- **A named onboarding quiz** — even though your behavioral DNA is better, the quiz gives you
  a shareable artifact on day zero, before you have any history to derive from. Use it as the
  cold-start prior, then let behavior override it. Best of both.

---

## 6. What to do first

If only three things happen:

1. **Ship something to the App Store within 60 days**, with a paywall in it, even if narrower
   than you want. Every analysis above is theoretical until real users exist. This means
   choosing StoreKit/RevenueCat *this week* — it's the longest pole and it hasn't started.
2. **Zero-catalog first value.** A real outfit + layer timeline in 60 seconds with no photos.
   Without this, acquisition leaks out the bottom regardless of how good the engine is.
3. **Pick the wedge and commit:** travel (§5.4) or widget-first daily (§5.5). Not both in the
   launch narrative. Travel is more defensible and higher-ARPU; widgets are more demo-able
   and cheaper to market. **Recommendation: lead with travel, retain with widgets.**

Deliberately deferred until after launch: B2B licensing, barcode scanning, Android ML Kit,
CoreML acceleration, widget UI redesign. All are good. None of them get a user.

---

## 7. Open questions / things to verify

- **Is Ojo's current classifier accuracy still 56.3%?** The Vision segmentation shipped after
  that measurement; the number is probably stale and possibly much better. Re-measure before
  treating it as a weakness.
- **PutTogether's actual install base.** 18 ratings suggests very low volume, but ratings are a
  weak proxy. Worth checking a third-party estimate before assuming they're beatable on
  distribution — or before assuming they're a real threat at all.
- **Their release date is ambiguous** — the listing reports v1.0 as April 2024, but the app ID
  is consistent with a late-2025 registration. Affects how fast they're actually moving.
- **Should Open-Meteo become a fallback/free tier for WeatherKit?** It would largely dissolve
  `docs/weatherkit-cost-plan.md`, at some accuracy cost worth measuring.
