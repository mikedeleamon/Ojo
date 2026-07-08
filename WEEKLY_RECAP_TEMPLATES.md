# Weekly Wardrobe Recap — Template Library

Copy + selection spec for turning the existing Weekly Recap notification stub
(`scheduleWeeklyRecap` in `src/lib/notifications.ts`) into a generated,
Wrapped-style recap. Every template slot below maps to a stat that
`insightsEngine.ts` / `userPreferences.ts` / `outfitHistory.ts` already derive —
no new data collection, no runtime LLM call. A future `recapEngine.ts` fills
slots from real data and picks 4–6 cards per week.

---

## Voice

The recap is a sharp friend who notices what you wear. It observes; it never
assigns homework. Rules:

- Second person, present tense. Items are characters ("your Rust Corduroy Jacket"),
  named from `articleSummary` / article color + category.
- **Numbers carry the drama.** Adjectives stay lean. "4 of 6 outfits" beats "so much green!"
- Never shame a quiet week or a sleeping item. Tease gently, then move on.
- At most one exclamation point per entire recap.
- Headlines render in DMSerifDisplay on a card — keep them ≤ 34 characters.
  Bodies are one sentence, two max, in Outfit.
- **Forbidden claims** (data doesn't exist to back them): per-outfit weather
  ("you dressed for rain"), location ("around town"), and anything prescriptive
  ("you should wear…"). `OutfitHistoryEntry` stores only
  `wornAt / closetId / articleIds / articleSummary`.

---

## Data dictionary

All derivable from `(closets, history, tripPlans, now)`:

| Slot | Source |
|---|---|
| `outfitCount`, `daysLogged` | `history` filtered to last 7 days; distinct local dates |
| `topColor`, `topColorCount` | `derivePreferenceProfile(closets, weekHistory).colors`, sorted |
| `colorA/colorB`, `pairCount` | same profile's `colorPairs` |
| `itemName`, `mvpCount` | max wears within week via `articleIds` join |
| `debutItem`, `debutDay` | item whose all-time wear count equals its this-week count |
| `wokeItem`, `dormantDays` | worn this week AND previous wear ≥ `SLEEPING_THRESHOLD` (90) days prior |
| `dormantItem` | `computeInsights(...).sleeping[0]` (longest `daysSinceWorn`) |
| `streak`, `streakStartDay` | max run of consecutive logged days (may extend before the week) |
| `cpw` | `ArticleInsight.costPerWear` via `formatCPW` |
| `dnaColor1/2`, `totalOutfits`, `level` | `computeStyleDNA` (thresholds: 10 = learning, 30 = active) |
| `milestone` | all-time `totalOutfits` crossing 10 / 30 / 50 / 100 / 250 within the week |
| `city`, `tripOutfitCount` | `SavedTripFitPlan` date-overlap with week; entries logged inside trip dates |
| `gapLabel`, `gapCount` | `getGapSuggestions` (`wardrobeGaps.ts`) |

---

## Templates

Each template: `id`, eligibility, headline variants (H), body variants (B).
The engine picks one H + one B via a seeded RNG (see Selection rules).

### Openers (exactly one, always first)

**`hero_week`** — `outfitCount ≥ 3`
- H1: "Seven days, {outfitCount} outfits."
- H2: "Your week, worn well."
- H3: "{outfitCount} outfits later…"
- B1: "You got dressed with intent on {daysLogged} of 7 days. Here's how it went."
- B2: "Logged across {daysLogged} days — your closet showed up this week."

**`hero_light`** — `outfitCount` 1–2
- H1: "Quality over quantity."
- H2: "A short story this week."
- B1: "{outfitCount} outfits logged — few enough to remember, good enough to recap."
- B2: "Not a busy week for the log, but the details below still earned a mention."

**`empty_week`** — `outfitCount == 0` (recap is this single card + nothing else)
- H1: "A week off the record."
- H2: "The closet kept quiet."
- B1: "No outfits logged this week. Tap 'Wore this' on your next one and the recap gets interesting."
- B2: "Nothing logged — even Ojo takes a week off sometimes. See you next Sunday."

### Color

**`color_story`** — `topColorCount ≥ 3` AND `topColorCount / outfitCount ≥ 0.4`
- H1: "{topColor} ran the week."
- H2: "A {topColor} kind of week."
- H3: "All signs point to {topColor}."
- B1: "It showed up in {topColorCount} of your {outfitCount} outfits. That's a favorite, not a phase."
- B2: "{topColorCount} appearances in seven days — at this point it's a personality trait."

**`color_pair`** — same color pair appeared ≥ 2× this week
- H1: "{colorA} + {colorB}, again."
- H2: "You've found your combo."
- B1: "That pairing landed {pairCount} times this week. The color wheel agrees with you."
- B2: "Twice is a coincidence — {pairCount} times is a signature."

### Items

**`mvp_item`** — one item worn ≥ 3× in week
- H1: "MVP: your {itemName}."
- H2: "One item did the heavy lifting."
- B1: "{mvpCount} appearances in seven days — someone's earning their hanger space."
- B2: "Your {itemName} clocked in {mvpCount} times this week. Give it the weekend off."

**`debut`** — first-ever wear happened this week
- H1: "A debut this week."
- H2: "First time out."
- B1: "Your {itemName} finally left the closet — logged for the first time on {debutDay}."
- B2: "Welcome to the rotation, {itemName}. First wear: {debutDay}."

**`woke_up`** — item dormant ≥ 90 days was worn this week
- H1: "Back from the bench."
- H2: "The {itemName} awakens."
- B1: "After {dormantDays} days off, your {itemName} got its moment. Welcome back."
- B2: "{dormantDays} days of silence, then this week happened. Comebacks look good on you."

**`still_sleeping`** — longest-dormant item ≥ 120 days (max 1× per month; skip if `woke_up` fired)
- H1: "Meanwhile, in the back…"
- H2: "Someone misses you."
- B1: "Your {itemName} hasn't been out in {dormantDays} days. No pressure — it remembers you, though."
- B2: "{dormantDays} days and counting for your {itemName}. Just leaving that here."

### Habits & milestones

**`streak`** — ≥ 4 consecutive days logged
- H1: "{streak} days straight."
- H2: "A streak is forming."
- B1: "An outfit logged every day since {streakStartDay}. The algorithm is taking notes — literally."
- B2: "{streak} days in a row. Your Style DNA is getting sharper by the outfit."

**`cpw_win`** — an item's cost-per-wear crossed below a round threshold ($10/$5/$1) this week
- H1: "Money well worn."
- H2: "Your {itemName} just got cheaper."
- B1: "Every wear counts — it's down to {cpw} per wear after this week."
- B2: "{cpw} a wear and falling. That's what a good buy looks like."

**`dna_consistent`** — week's `topColor` ∈ `styleDNA.topColors`, `level ≥ learning`
- H1: "On brand, as ever."
- H2: "Your Style DNA holds."
- B1: "{topColor} again — the same signature Ojo has learned from {totalOutfits} logged outfits."
- B2: "Some things don't change: {topColor} stays at the top of your rotation."

**`dna_plot_twist`** — week's `topColor` ∉ `styleDNA.topColors`, worn ≥ 3×, `level == active`
- H1: "A plot twist."
- H2: "New color in the lead."
- B1: "{topColor} isn't in your usual top three ({dnaColor1}, {dnaColor2}) — but it owned this week."
- B2: "Your Style DNA says {dnaColor1}. This week said {topColor}. We'll see who wins."

**`milestone`** — all-time `totalOutfits` crossed a threshold this week
- H1: "Outfit #{milestone}, logged."
- H2: "That's {milestone} outfits."
- B at 10: "Ojo's officially learning your style now — suggestions start bending your way."
- B at 30: "Personalization unlocked: your suggestions are now fully tuned to you."
- B at 50/100/250: "Most people can't name {milestone} outfits they've worn. You have receipts."

### Context

**`trip_week`** — a `SavedTripFitPlan`'s dates overlapped this week
- H1: "The {city} week."
- H2: "You packed. It worked."
- B1: "{tripOutfitCount} outfits logged during your {city} trip — planned before you even left."
- B2: "Your {city} TripFit met the real world this week. {tripOutfitCount} outfits made the log."

**`gap_nudge`** — `getGapSuggestions` fires (≥ 4 occurrences / 30 days). Max one per recap, always second-to-last, mirrors the Wardrobe Gap Card's shop CTA.
- H1: "One gap keeps showing up."
- H2: "Your closet has a wishlist."
- B1: "{gapLabel} would've completed {gapCount} outfits this month. Just saying."
- B2: "Ojo keeps reaching for {gapLabel} that isn't there — {gapCount} times and counting."

### Closer (always last when ≥ 3 cards shown)

**`share_cta`**
- H1: "That was your week."
- H2: "Worn. Logged. Recapped."
- B1: "Share it, or let next week top it."
- B2: "Seven days, fully accounted for. Next week starts tomorrow."
- CTA button: "Share to Instagram" → reuses `ShareCardFrame` / `ShareToInstagramSheet`.

---

## Selection rules

1. **Evaluate** every template's eligibility against the week's data.
2. **Compose**: opener first → 2–4 middle cards → `gap_nudge` (if any) → `share_cta`.
   Hard cap: 6 cards. Floor: opener + 1 (else just `empty_week`).
3. **Variety**: max one card per section (Color / Items / Habits & milestones / Context).
   Exception: `milestone` may join another Habits card — milestones outrank variety.
4. **Salience order** when too many are eligible:
   `milestone > trip_week > dna_plot_twist > woke_up > streak > color_story > mvp_item > debut > color_pair > cpw_win > dna_consistent > still_sleeping`.
5. **Cooldown**: a template shown last week is skipped this week
   (`still_sleeping`: 4 weeks). Store shown ids in AsyncStorage
   (`ojo_recap_shown_<isoWeek>`).
6. **Determinism**: seed the H/B-variant RNG with the ISO week number + user id,
   so reopening the same recap always renders identical copy.

---

## Notification copy (replaces the static stub)

Rotate weekly by ISO-week seed; deep link `ojo://recap` (add to
`app/+native-intent.tsx` alongside the widget routes):

1. "Your week, worn well" — "{outfitCount} outfits, one favorite color, and a comeback. See your recap."
2. "The recap is in" — "Your closet had opinions this week. See what they were."
3. "Seven days of outfits" — "One item carried the week. Find out which."

(If the notification must stay static — it's scheduled ahead of time — use
variant 2 as the default; it promises nothing specific.)

---

## Implementation sketch (not in scope for this doc)

- `src/lib/recapEngine.ts` — pure `buildWeeklyRecap(closets, history, plans, now): RecapCard[]`,
  mirroring `insightsEngine.ts`'s pure-computation pattern; unit-testable the same way.
- Recap screen at `/account/recap`; notification deep-links to it.
- Cards reuse the glassmorphism card language; final card mounts the existing
  IG share flow with a new `RecapShareCard` template inside `ShareCardFrame`.
