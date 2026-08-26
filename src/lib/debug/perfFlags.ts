/**
 * perfFlags — runtime toggles for bisecting WeatherHUD's frame-rate problem.
 *
 * DEV TOOL. The panel that drives these (components/debug/PerfPanel) only
 * renders under __DEV__, and every flag now defaults to the shipped behaviour,
 * so a production build is unaffected. That is `true` for everything except
 * `outfitSwipeHint`, which ships off.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Two attempts at fixing the clear-night stutter were made by reading the code
 * and reasoning about which layer "must" be expensive. Both were wrong — the
 * second (a full-screen gradient scrim replacing BackdropLayer's group opacity)
 * measurably made scrolling worse. Reasoning from structure failed twice, so
 * these were added to measure instead of infer.
 *
 * ── What the measurement actually found ──────────────────────────────────────
 * Not the glass, and not the blur. The wins, in rough order of impact:
 *
 *   1. WeatherDetails / OutfitSuggestion weren't memoised, so every WeatherHUD
 *      state change — including `miniVisible` flipping mid-scroll — reconciled
 *      the largest subtree on the screen. Cost scaled with card size, which is
 *      why "smaller outfit card" looked like the variable.
 *   2. The loading overlay never unmounted, and its spinner's Animated.loop
 *      never stopped: a full-screen zIndex-10 layer at opacity 0 with an icon
 *      rotating at display rate, for the life of the screen.
 *   3. Standing animated layers wrapping large subtrees (the swipe hint, the
 *      carousel crossfade) — attached from first render for transitions that
 *      hadn't happened yet.
 *   4. Freezing the clear-night twinkle past SCROLL_RANGE.
 *
 * With those fixed, the glass and backdrop flags can all sit on without the
 * screen stuttering — hence the defaults below.
 *
 * Each flag still isolates one candidate, for when this comes back:
 *
 *   glass                 → the Liquid Glass material re-blurring its backdrop
 *   twinkle               → animation invalidating that blur every frame
 *   backdrop              → the sky's own fill rate, independent of blur
 *   parallax              → the scroll-driven dim + transform on the backdrop
 *   outfitCardGlass       → the big details/outfit container being glass
 *   outfitInnerGlass      → the thumbnails + layer stack inside it being glass
 *   opaqueOutfitCard      → that card being translucent at all (see its doc)
 *   outfitSwipeHint       → the swipe-hint bounce and the animated layer it needs
 *   outfitCrossfade       → the animated-opacity layer wrapping the carousel
 *   freezeTwinkleOnScroll → clear-night twinkle continuing while scrolled away
 *
 * Note these are not independent: `backdrop` off implies nothing is animating
 * behind the glass, so it subsumes `twinkle`. Test the narrow flags first.
 */

import { useSyncExternalStore } from 'react';

export interface PerfFlags {
    /** Let GlassCard use the native glass material. Off → translucent fallback. */
    glass: boolean;
    /** Run the star twinkle / rain fall animations in the full-screen backdrop. */
    twinkle: boolean;
    /** Render the full-screen weather backdrop at all. */
    backdrop: boolean;
    /** Apply the scroll-driven parallax and dim to the backdrop. */
    parallax: boolean;
    /** Give the outfit/details CONTAINER its own glass material. */
    outfitCardGlass: boolean;
    /**
     * Give the surfaces inside the outfit card their own glass material — the
     * article thumbnails and the layering stack.
     */
    outfitInnerGlass: boolean;
    /**
     * Make the outfit/details card fully OPAQUE instead of translucent.
     *
     * Was a hypothesis from before the real causes were found, and it is not
     * independent of `outfitCardGlass`: GlassCard strips backgroundColor on the
     * native glass path, so with both on this is inert on iOS 26 and applies
     * only on the fallback path. See the note at its use site in WeatherHUD.
     */
    opaqueOutfitCard: boolean;
    /**
     * Run the swipe-hint bounce that nudges the user through generated outfits.
     *
     * The only flag that ships OFF. The bounce fires once, but its delivery
     * mechanism doesn't: the entire outfit pager is wrapped in an
     * RNAnimated.View carrying an interpolated translateX, so that whole
     * subtree stays a standing animated layer for the life of the screen.
     */
    outfitSwipeHint: boolean;
    /**
     * Keep the carousel/confirmation crossfade wired up from first render.
     *
     * Note the shipped path is gated on `confirmEverNeeded` regardless of this
     * flag, so the animated layer still only attaches once a crossfade can
     * actually happen. This forces it on from the start for comparison.
     */
    outfitCrossfade: boolean;
    /**
     * Freeze the clear-night star twinkle past SCROLL_RANGE, where the backdrop
     * has dimmed to MIN_DIM and stopped moving.
     *
     * Clear night only — rain, drizzle and storm are deliberately unaffected.
     */
    freezeTwinkleOnScroll: boolean;
}

export const PERF_FLAG_LABELS: Record<keyof PerfFlags, string> = {
    glass: 'Liquid Glass',
    twinkle: 'Sky animation',
    backdrop: 'Sky backdrop',
    parallax: 'Parallax + dim',
    outfitCardGlass: 'Outfit card glass',
    outfitInnerGlass: 'Outfit inner glass',
    opaqueOutfitCard: 'Opaque outfit card',
    outfitSwipeHint: 'Outfit swipe hint',
    outfitCrossfade: 'Outfit crossfade layer',
    freezeTwinkleOnScroll: 'Freeze twinkle on scroll',
};

// Mirrors the production build: everything on except the swipe hint.
const DEFAULTS: PerfFlags = {
    glass: true,
    twinkle: true,
    backdrop: true,
    parallax: true,
    outfitCardGlass: true,
    outfitInnerGlass: true,
    opaqueOutfitCard: true,
    outfitSwipeHint: false,
    outfitCrossfade: true,
    freezeTwinkleOnScroll: true,
};

let flags: PerfFlags = DEFAULTS;
const listeners = new Set<() => void>();

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};

// Identity is stable while nothing changes — required for useSyncExternalStore
// (a fresh object every call would loop forever) and it keeps the flags from
// re-rendering the HUD when an unrelated bit of state moves.
const getSnapshot = () => flags;

export const setPerfFlag = <K extends keyof PerfFlags>(
    key: K,
    value: PerfFlags[K],
) => {
    if (flags[key] === value) return;
    flags = { ...flags, [key]: value };
    listeners.forEach((l) => l());
};

export const togglePerfFlag = (key: keyof PerfFlags) =>
    setPerfFlag(key, !flags[key]);

export const resetPerfFlags = () => {
    if (flags === DEFAULTS) return;
    flags = DEFAULTS;
    listeners.forEach((l) => l());
};

export const usePerfFlags = (): PerfFlags =>
    useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
