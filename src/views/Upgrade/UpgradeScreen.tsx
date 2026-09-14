import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    ReactNode,
} from 'react';
import {
    ActivityIndicator,
    Animated,
    AccessibilityInfo,
    StyleSheet,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Svg,
    Path,
    Line,
    Rect,
    Defs,
    RadialGradient,
    LinearGradient as SvgLinearGradient,
    Stop,
} from 'react-native-svg';
import Purchases, {
    PurchasesPackage,
    PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import {
    View,
    Text,
    Pressable,
    ScrollView,
    GlassCard,
    IconButton,
} from '../../components/primitives';
import { CloseIcon, GridIcon, TripFitIcon } from '../../components/icons/ClosetIcons';
import { HangerIcon } from '../../components/shared/HangerIcon';
import SunnyIcon from '../../components/WeatherIcons/SunnyIcon';
import { useTheme, ForceDarkPalette } from '../../theme/ThemeContext';
import { usePurchases, ENTITLEMENT_ID } from '../../context/PurchasesContext';
import { FREE_ITEM_LIMIT } from '../../config/limits';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { nativeLoop, pingPong } from '../../lib/animation/nativeLoop';
import {
    spacing,
    radius,
    fonts,
    fontSizes,
    darkColors,
} from '../../theme/tokens';

// The app icon's own diagonal mint→leaf gradient (see OjoLogoIcon's j-gradient
// and the widget's brand ramp) — the fixed "Ojo Pro" brand moment, independent
// of the user's light/dark theme choice, same as the always-dark Recap screen.
//
// It is now spent in exactly ONE place: the CTA. Running it full-bleed behind
// the whole screen was what made the button dissolve — the ramp ends at #56b107
// and so did the background directly under it, so the button lost its right
// edge. Held back to the button, it is the brightest thing on the screen.
const BRAND_GRADIENT = ['#4feec3', '#87DE5A', '#65ba02'] as const;
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

// The field the brand sits on. A near-ink vertical ramp, with the mint allowed
// back in as a soft bloom behind the logo (BrandField below) rather than as
// wallpaper. Everything downstream depends on this: white body copy on the old
// muted-green field measured ~2.5:1, and the brand-green feature icons ~1.3:1
// against their own chips — i.e. very nearly invisible. On this field the same
// unmodified colors land at 9.9:1 and 4.2:1.
const INK_TOP = '#193823';
const INK_BASE = '#0F172A';
const V_START = { x: 0.5, y: 0 };
const V_END = { x: 0.5, y: 1 };
const INK_LOCATIONS = [0, 0.62] as const;

// The icon set's shared lime→leaf ramp (ClosetIcons' tripGrad). TripFitIcon
// hard-codes it and takes no color prop, so the icons could never have been
// recolored to fix their contrast — the background was the only lever.
const ICON_GRADIENT = { from: '#C8FF78', to: '#4BAA15' } as const;

// The two bloom states the background crossfades between. Fading A→B swells
// the glow and warms it toward lime without a single pixel translating.
//
// A is the resting state and carries the brand presence behind the headline.
// B is deliberately SHALLOWER (smaller ry) and much stronger: its swing is
// concentrated in the empty band above the logo — roughly the top 140pt,
// where the close button sits and no copy does — and has decayed to ~10%
// opacity by the eyebrow at y≈159. That is what lets the amplitude be large
// enough to actually read as motion while the text below keeps the contrast
// this redesign was built to win (eyebrow stays ~8.5:1 at the peak, against
// the 4.5:1 floor).
type BloomSpec = {
    cx: string;
    cy: string;
    rx: string;
    ry: string;
    mintColor: string;
    mint: number;
    leafColor: string;
    leaf: number;
};
const BLOOM_A: BloomSpec = {
    cx: '48%',
    cy: '-12%',
    rx: '125%',
    ry: '62%',
    mintColor: '#4feec3',
    mint: 0.44,
    leafColor: '#65ba02',
    leaf: 0.26,
};
const BLOOM_B: BloomSpec = {
    cx: '56%',
    cy: '-31%',
    rx: '105%',
    ry: '144%',
    mintColor: '#4feec3',
    mint: 0.78,
    leafColor: '#9FE870',
    leaf: 0.3,
};
// One full breath every 9s. At 22s the rate of change per frame was below the
// threshold where a slow luminance ramp reads as movement at all.
const BLOOM_CYCLE_MS = 9000;

// B is the only layer whose pixels change, and its own falloff already reaches
// zero at ~24% of the screen height — above the first glass card at ~38%. So
// it gets a bounded band rather than absoluteFill: visually identical, but the
// area behind every GlassCard is then genuinely static, and a native glass
// material only re-blurs when what sits behind it changes. See GlassCard's
// `disableGlass` note on why glass over an animating backdrop is the
// expensive case. B's cy/ry below are expressed against this band, not the
// screen: -31% × 32% ≈ -10% of screen height, 144% × 32% ≈ 46%.
const BLOOM_B_BAND = '32%';

export default function UpgradeScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const { isConfigured, isPro, isReady } = usePurchases();

    const close = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/account');
    };

    // No RevenueCat API key set yet (dashboard/store products not configured)
    // — fetching offerings or rendering a paywall in this state would just
    // surface the SDK's own raw errors. Show something a real user could
    // actually make sense of instead.
    if (!isConfigured) {
        return (
            <View
                style={[
                    styles.placeholderRoot,
                    { backgroundColor: colors.bgDefault },
                ]}
            >
                <GlassCard style={styles.placeholderCard}>
                    <Text
                        style={[
                            styles.placeholderTitle,
                            { color: colors.textPrimary },
                        ]}
                    >
                        Ojo Pro is almost here
                    </Text>
                    <Text
                        style={[
                            styles.placeholderBody,
                            { color: colors.textMuted },
                        ]}
                    >
                        Subscriptions aren't set up on this build yet — check
                        back soon.
                    </Text>
                    <Pressable
                        style={[
                            styles.placeholderBtn,
                            {
                                backgroundColor: colors.glassBg,
                                borderColor: colors.glassBorder,
                            },
                        ]}
                        onPress={close}
                        accessibilityRole='button'
                        accessibilityLabel='Go back'
                    >
                        <Text
                            style={[
                                styles.placeholderBtnText,
                                { color: colors.textPrimary },
                            ]}
                        >
                            Go back
                        </Text>
                    </Pressable>
                </GlassCard>
            </View>
        );
    }

    // Already subscribed. Re-presenting the purchase CTA to a paying subscriber
    // is how they end up buying again and hitting StoreKit's
    // PRODUCT_ALREADY_PURCHASED — and App Review opens this screen from the
    // settings row after purchasing. Show what they have, and the one action
    // that is actually theirs to take: Apple and Google own cancellation and
    // refunds, so this hands off to the store's own sheet rather than
    // pretending we can do it here.
    if (isReady && isPro) {
        return (
            <View
                style={[
                    styles.placeholderRoot,
                    { backgroundColor: colors.bgDefault },
                ]}
            >
                <GlassCard style={styles.placeholderCard}>
                    <Text
                        style={[
                            styles.placeholderTitle,
                            { color: colors.textPrimary },
                        ]}
                    >
                        Ojo Pro is active
                    </Text>
                    <Text
                        style={[
                            styles.placeholderBody,
                            { color: colors.textMuted },
                        ]}
                    >
                        Unlimited saved trips and Style DNA are unlocked on this
                        account. Your renewal date and plan live in your App
                        Store subscription settings.
                    </Text>
                    <Pressable
                        style={[
                            styles.placeholderBtn,
                            {
                                backgroundColor: colors.glassBg,
                                borderColor: colors.glassBorder,
                            },
                        ]}
                        // Resolves when the sheet is dismissed and rejects when
                        // the platform can't open it (Android without Play, a
                        // purchase made on another store). Either way there is
                        // nothing useful to say, and no state of ours to undo.
                        onPress={() => {
                            Purchases.showManageSubscriptions().catch(() => {});
                        }}
                        accessibilityRole='button'
                        accessibilityLabel='Manage subscription'
                    >
                        <Text
                            style={[
                                styles.placeholderBtnText,
                                { color: colors.textPrimary },
                            ]}
                        >
                            Manage subscription
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={close}
                        accessibilityRole='button'
                        accessibilityLabel='Go back'
                    >
                        <Text
                            style={[
                                styles.placeholderBtnText,
                                { color: colors.textMuted },
                            ]}
                        >
                            Go back
                        </Text>
                    </Pressable>
                </GlassCard>
            </View>
        );
    }

    return <OjoProPaywall onClose={close} />;
}

type PlanKey = 'monthly' | 'annual';

type OfferingState =
    | { status: 'loading' }
    | {
          status: 'ready';
          monthly: PurchasesPackage | null;
          annual: PurchasesPackage | null;
          // Only used when the offering exposes neither a monthly nor an annual
          // package — we can show its price but can't name its period, so the
          // per-period suffixes are suppressed for it.
          other: PurchasesPackage | null;
      }
    | { status: 'error' };

const PERIOD_SUFFIX: Record<PlanKey, string> = {
    monthly: ' per month',
    annual: ' per year',
};

/**
 * The free-trial window as StoreKit actually reports it, or null when the
 * product has no introductory offer. Derived rather than hard-coded so the
 * CTA can never promise a trial the store won't honour — if the offer is
 * removed in App Store Connect, the button quietly goes back to "Unlock".
 */
function trialWindow(pkg: PurchasesPackage | null): string | null {
    const intro = pkg?.product.introPrice;
    if (!intro || intro.price > 0) return null;

    const units = intro.periodNumberOfUnits * Math.max(intro.cycles, 1);
    if (units <= 0) return null;

    switch (intro.periodUnit) {
        case 'DAY':
            return `${units} ${units === 1 ? 'day' : 'days'}`;
        case 'WEEK':
            return units === 1 ? '7 days' : `${units} weeks`;
        case 'MONTH':
            return `${units} ${units === 1 ? 'month' : 'months'}`;
        case 'YEAR':
            return `${units} ${units === 1 ? 'year' : 'years'}`;
        default:
            return null;
    }
}

/** 'error' = it failed. 'info' = it did NOT fail, but the user has to know
 *  something — the two must not look alike, or a pending payment reads as a
 *  rejected card and the user buys again. */
type Feedback = { tone: 'error' | 'info'; text: string };

/**
 * Turn a RevenueCat failure into something a person can act on, or null when
 * there is nothing to say.
 *
 * The store fails in ways that need genuinely different responses, and a
 * single "Something went wrong" is wrong for most of them: it tells a user
 * whose payment is merely PENDING to try again (and risk paying twice), tells
 * a user who already owns Pro to retry instead of restoring, and tells a user
 * with purchases disabled by Screen Time to keep hammering a button that can
 * never work.
 */
function purchaseFailure(error: unknown): Feedback | null {
    const code = (error as { code?: PURCHASES_ERROR_CODE } | null)?.code;

    switch (code) {
        // Backing out is not a failure. Saying anything here turns the user's own
        // deliberate choice into what looks like a rejection.
        case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR:
            return null;

        // Mostly Android: Google Play deferred payments (cash at a convenience
        // store, a parent's approval, a slow bank card) land here. The purchase
        // has NOT failed and may complete minutes or days later — RevenueCat
        // grants the entitlement when it clears. Calling this an error is the
        // single most damaging thing this screen could say.
        case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
            return {
                tone: 'info',
                text: 'Your payment is still being confirmed. Ojo Pro unlocks as soon as it clears — you do not need to buy again.',
            };

        case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
        case PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR:
            return {
                tone: 'info',
                text: 'You already have a subscription. Tap Restore purchases to unlock it on this account.',
            };

        case PURCHASES_ERROR_CODE.NETWORK_ERROR:
        case PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR:
            return {
                tone: 'error',
                text: 'Could not reach the store. Check your connection and try again.',
            };

        // Terminal on this device — Screen Time, MDM, or a family account. Retry
        // advice would be a lie.
        case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
            return {
                tone: 'error',
                text: 'Purchases are turned off on this device. Check Screen Time or your account restrictions.',
            };

        case PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR:
        case PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR:
            return {
                tone: 'error',
                text: 'The store is not responding right now. Please try again in a moment.',
            };

        case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
        case PURCHASES_ERROR_CODE.INELIGIBLE_ERROR:
            return {
                tone: 'error',
                text: 'This plan is not available on your account right now.',
            };

        default:
            return {
                tone: 'error',
                text: 'The purchase did not go through. Please try again.',
            };
    }
}

function OjoProPaywall({ onClose }: { onClose: () => void }) {
    const insets = useSafeAreaInsets();
    const nav = useAppNavigation();

    const [offering, setOffering] = useState<OfferingState>({
        status: 'loading',
    });
    // Monthly leads: it is the number we want read first, and the annual card
    // beside it exists to give that number an anchor.
    const [preferred, setPreferred] = useState<PlanKey>('monthly');
    const [purchasing, setPurchasing] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [feedback, setFeedback] = useState<Feedback | null>(null);

    useEffect(() => {
        let alive = true;
        Purchases.getOfferings()
            .then((offerings) => {
                if (!alive) return;
                const current = offerings.current;
                const monthly = current?.monthly ?? null;
                const annual = current?.annual ?? null;
                const other =
                    monthly || annual
                        ? null
                        : (current?.availablePackages[0] ?? null);
                setOffering(
                    monthly || annual || other
                        ? { status: 'ready', monthly, annual, other }
                        : { status: 'error' },
                );
            })
            .catch(() => {
                if (alive) setOffering({ status: 'error' });
            });
        return () => {
            alive = false;
        };
    }, []);

    const plans = offering.status === 'ready' ? offering : null;
    const bothPlans = Boolean(plans?.monthly && plans?.annual);

    // Derived rather than stored, so `preferred` can never point at a package
    // the offering doesn't actually have.
    const planKey: PlanKey = bothPlans
        ? preferred
        : plans?.monthly
          ? 'monthly'
          : 'annual';
    const selectedPkg = plans
        ? (plans.other ?? (planKey === 'annual' ? plans.annual : plans.monthly))
        : null;

    // Savings are computed from the two real prices, never hard-coded, so the
    // badge follows whatever is configured in RevenueCat. pricePerYear is the
    // SDK's own annualisation of the monthly product.
    const savingsPct = useMemo(() => {
        if (!plans?.annual || !plans?.monthly) return null;
        const annualized =
            plans.monthly.product.pricePerYear ??
            plans.monthly.product.price * 12;
        if (!annualized || annualized <= 0) return null;
        const pct = Math.round(
            (1 - plans.annual.product.price / annualized) * 100,
        );
        return pct >= 5 ? pct : null;
    }, [plans]);

    const trial = trialWindow(selectedPkg);
    const periodSuffix = plans?.other ? '' : PERIOD_SUFFIX[planKey];

    // A failure that only appears visually is no failure state at all for a
    // screen reader user, who may well be mid-purchase with the screen off.
    const say = useCallback((next: Feedback | null) => {
        setFeedback(next);
        if (next) AccessibilityInfo.announceForAccessibility(next.text);
    }, []);

    const handlePurchase = useCallback(async () => {
        if (!selectedPkg || purchasing) return;
        setPurchasing(true);
        say(null);
        try {
            const { customerInfo } =
                await Purchases.purchasePackage(selectedPkg);
            // Resolving means the STORE accepted the payment, not that this account
            // ended up entitled. Closing on the strength of the promise alone would
            // dismiss the paywall with nothing unlocked and no explanation.
            if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
                onClose();
            } else {
                say({
                    tone: 'error',
                    text: 'Your payment went through but Pro could not be unlocked. Tap Restore purchases, or contact us if it keeps happening.',
                });
            }
        } catch (error) {
            say(purchaseFailure(error));
        } finally {
            setPurchasing(false);
        }
    }, [selectedPkg, purchasing, onClose, say]);

    const handleRestore = useCallback(async () => {
        if (restoring) return;
        setRestoring(true);
        say(null);
        try {
            const info = await Purchases.restorePurchases();
            if (info.entitlements.active[ENTITLEMENT_ID]) {
                onClose();
            } else {
                say({
                    tone: 'info',
                    text: 'No active subscription found for this account.',
                });
            }
        } catch (error) {
            const mapped = purchaseFailure(error);
            say(
                mapped ?? {
                    tone: 'error',
                    text: 'Restore failed — please try again.',
                },
            );
        } finally {
            setRestoring(false);
        }
    }, [restoring, onClose, say]);

    const ctaDisabled = !selectedPkg || purchasing;
    const ctaLabel =
        offering.status === 'error'
            ? 'Unavailable'
            : trial
              ? `Start ${trial} free`
              : 'Unlock Ojo Pro';

    return (
        // The paywall is a fixed dark brand moment whatever theme the app is in,
        // so the palette is pinned rather than inherited. GlassCard reads isDark
        // from this context to pick the native material's appearance — without it,
        // a user on the light theme would get light glass on a near-black field.
        <ForceDarkPalette>
            <View style={styles.root}>
                {/* This screen is a full-bleed brand moment (like Recap) rather than a
          titled sub-page, so it opts out of the account stack's shared header. */}
                <Stack.Screen options={{ headerShown: false }} />
                <StatusBar style='light' />
                <BrandField />

                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={[
                        styles.content,
                        {
                            paddingTop: insets.top,
                            paddingBottom: insets.bottom + 24,
                        },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.headerRow}>
                        <IconButton
                            icon={
                                <CloseIcon
                                    size={16}
                                    color='#ffffff'
                                    decorative
                                />
                            }
                            onPress={onClose}
                            accessibilityLabel='Close'
                            style={styles.closeBtn}
                        />
                    </View>

                    <View style={styles.hero}>
                        <SunnyIcon
                            size={34}
                            color='#ffffff'
                        />
                        <Text style={styles.eyebrow}>Ojo Pro</Text>
                        <Text style={styles.headline}>
                            Room for{'\n'}everything you own.
                        </Text>
                        <Text style={styles.subhead}>
                            Ojo gets smarter every time you use it. Pro lifts
                            the limits and opens up what it learns.
                        </Text>
                    </View>

                    <View style={styles.features}>
                        {/* Ordered by how often each gate is actually met, so
                            the first row is the reason most people are here. */}
                        <FeatureRow
                            icon={<HangerIcon size={23} color='#ffffff' decorative />}
                            title='Unlimited items'
                            body={`Free covers ${FREE_ITEM_LIMIT} items — enough for a full year of weather. Pro removes the cap.`}
                        />
                        <FeatureRow
                            icon={<GridIcon size={22} color='#ffffff' />}
                            title='Unlimited closets'
                            body='Free includes one closet. Pro adds a travel closet, a seasonal one, as many as you like.'
                        />
                        <FeatureRow
                            icon={<TripFitIcon size={24} />}
                            title='Unlimited saved trips'
                            body="Free keeps 1 trip at a time. Pro keeps every trip you're planning."
                        />
                        <FeatureRow
                            icon={<StyleDnaGlyph size={21} />}
                            title='Your Style DNA'
                            body='Top colors, fabrics and pairings, learned from what you actually wear.'
                        />
                    </View>

                    {offering.status === 'loading' ? (
                        <GlassCard style={styles.planPlaceholder}>
                            <ActivityIndicator color='#ffffff' />
                        </GlassCard>
                    ) : offering.status === 'error' ? (
                        <GlassCard style={styles.planPlaceholder}>
                            <Text style={styles.priceUnavailable}>
                                Pricing unavailable — check back soon
                            </Text>
                        </GlassCard>
                    ) : bothPlans ? (
                        <View style={styles.planRow}>
                            <PlanCard
                                label='Monthly'
                                priceString={
                                    plans!.monthly!.product.priceString
                                }
                                unit='/mo'
                                sub='billed monthly'
                                selected={planKey === 'monthly'}
                                onPress={() => setPreferred('monthly')}
                            />
                            <PlanCard
                                label='Annual'
                                priceString={plans!.annual!.product.priceString}
                                unit='/yr'
                                sub={
                                    plans!.annual!.product.pricePerMonthString
                                        ? `${plans!.annual!.product.pricePerMonthString} / month`
                                        : 'billed yearly'
                                }
                                badge={
                                    savingsPct ? `SAVE ${savingsPct}%` : null
                                }
                                selected={planKey === 'annual'}
                                onPress={() => setPreferred('annual')}
                            />
                        </View>
                    ) : (
                        <GlassCard style={styles.singlePlan}>
                            <View style={styles.priceRow}>
                                <Text style={styles.priceValue}>
                                    {selectedPkg?.product.priceString}
                                </Text>
                                {periodSuffix ? (
                                    <Text style={styles.priceUnit}>
                                        {planKey === 'annual'
                                            ? '/ year'
                                            : '/ month'}
                                    </Text>
                                ) : null}
                            </View>
                            <Text style={styles.priceSub}>Cancel anytime</Text>
                        </GlassCard>
                    )}

                    <View style={styles.ctaWrap}>
                        <Pressable
                            onPress={handlePurchase}
                            disabled={ctaDisabled}
                            accessibilityRole='button'
                            accessibilityLabel={ctaLabel}
                            accessibilityState={{ disabled: ctaDisabled }}
                        >
                            <LinearGradient
                                colors={BRAND_GRADIENT}
                                start={GRADIENT_START}
                                end={GRADIENT_END}
                                style={[
                                    styles.cta,
                                    ctaDisabled && styles.ctaDisabled,
                                ]}
                            >
                                {purchasing ? (
                                    <ActivityIndicator color='#0F172A' />
                                ) : (
                                    <Text style={styles.ctaText}>
                                        {ctaLabel}
                                    </Text>
                                )}
                            </LinearGradient>
                        </Pressable>
                        {selectedPkg ? (
                            <Text style={styles.ctaSub}>
                                {trial
                                    ? `Then ${selectedPkg.product.priceString}${periodSuffix}. Cancel anytime.`
                                    : 'Cancel anytime.'}
                            </Text>
                        ) : null}
                    </View>

                    {feedback && (
                        <View
                            style={[
                                styles.feedback,
                                feedback.tone === 'error'
                                    ? styles.feedbackError
                                    : styles.feedbackInfo,
                            ]}
                            accessibilityLiveRegion='polite'
                            accessibilityRole='alert'
                        >
                            <Text
                                style={[
                                    styles.feedbackText,
                                    feedback.tone === 'error'
                                        ? styles.feedbackTextError
                                        : styles.feedbackTextInfo,
                                ]}
                            >
                                {feedback.text}
                            </Text>
                        </View>
                    )}

                    <Pressable
                        onPress={handleRestore}
                        disabled={restoring}
                        accessibilityRole='button'
                        accessibilityLabel='Restore purchases'
                    >
                        <Text style={styles.restoreText}>
                            {restoring ? 'Restoring…' : 'Restore purchases'}
                        </Text>
                    </Pressable>

                    <View style={styles.legalWrap}>
                        <Text style={styles.legalBody}>
                            {trial
                                ? 'Your free trial becomes a paid subscription unless cancelled at least 24 hours before it ends. Payment is charged to your Apple ID.'
                                : 'Payment charged to your Apple ID at confirmation. Subscription auto-renews unless cancelled at least 24 hours before the end of the period.'}
                        </Text>
                        <View style={styles.legalLinksRow}>
                            <Pressable
                                onPress={() =>
                                    nav.push('/account/legal', {
                                        docType: 'terms',
                                    })
                                }
                                accessibilityRole='button'
                                accessibilityLabel='Terms of Service'
                            >
                                <Text style={styles.legalLink}>
                                    Terms of Service
                                </Text>
                            </Pressable>
                            <Text style={styles.legalDot}> · </Text>
                            <Pressable
                                onPress={() =>
                                    nav.push('/account/legal', {
                                        docType: 'privacy',
                                    })
                                }
                                accessibilityRole='button'
                                accessibilityLabel='Privacy Policy'
                            >
                                <Text style={styles.legalLink}>
                                    Privacy Policy
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </ForceDarkPalette>
    );
}

/**
 * BrandField — a near-ink vertical ramp with the brand's mint breathing over
 * the top of it.
 *
 * The screen this replaced ran the full brand gradient edge to edge under a
 * flat 38% scrim, which muted the ramp into a single olive tone (so the
 * gradient read as a solid colour) while still leaving every text role and
 * both feature icons below AA. Confining the brand to a soft top bloom keeps
 * the colour story and hands the rest of the screen a field dark enough to
 * actually read on.
 *
 * The motion is a CROSSFADE, not a translation: two blooms of different
 * weight and centre are stacked, and only the top one's opacity animates.
 * Sliding a layer — however much slack it carries beyond the viewport — moves
 * a rigid shape across the screen, which reads as the whole background
 * sliding rather than the gradient animating. Fading between two fixed states
 * keeps every pixel where it is and changes only its colour, so the glow
 * swells and shifts weight in place. Same approach as
 * RecapGradientBackground, which ping-pongs stacked LinearGradients by
 * opacity; opacity is native-driver friendly, so this stays off the JS thread
 * like the rest of src/lib/animation/nativeLoop.
 *
 * Honors Reduce Motion (WCAG 2.3.3) by holding the first bloom.
 */
function BrandField() {
    const [reduceMotion, setReduceMotion] = useState(false);
    const t = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let alive = true;
        AccessibilityInfo.isReduceMotionEnabled()
            .then((v) => {
                if (alive) setReduceMotion(v);
            })
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        if (reduceMotion) return;
        const loop = nativeLoop(t, BLOOM_CYCLE_MS);
        loop.start();
        return () => {
            loop.stop();
        };
    }, [reduceMotion, t]);

    // 0 → 1 → 0: layer B fades in over A and back out, forever. No swap step is
    // needed (unlike Recap, which cycles a longer list), so there is no covered
    // layer to reload and no chance of flashing the wrong gradient.
    const opacity = t.interpolate(pingPong(0, 1));

    return (
        <View
            style={StyleSheet.absoluteFill}
            pointerEvents='none'
        >
            <LinearGradient
                colors={[INK_TOP, INK_BASE]}
                locations={INK_LOCATIONS}
                start={V_START}
                end={V_END}
                style={StyleSheet.absoluteFill}
            />
            <Bloom
                id='ojoProBloomA'
                spec={BLOOM_A}
            />
            {!reduceMotion && (
                <Animated.View style={[styles.bloomBand, { opacity }]}>
                    <Bloom
                        id='ojoProBloomB'
                        spec={BLOOM_B}
                    />
                </Animated.View>
            )}
        </View>
    );
}

/** One static mint bloom, sized in percentages of the screen-sized box it
 *  fills. Nothing here moves — BrandField animates between two of them. */
function Bloom({ id, spec }: { id: string; spec: BloomSpec }) {
    return (
        <Svg
            style={StyleSheet.absoluteFill}
            width='100%'
            height='100%'
        >
            <Defs>
                <RadialGradient
                    id={id}
                    cx={spec.cx}
                    cy={spec.cy}
                    rx={spec.rx}
                    ry={spec.ry}
                >
                    <Stop
                        offset='0'
                        stopColor={spec.mintColor}
                        stopOpacity={spec.mint}
                    />
                    <Stop
                        offset='0.4'
                        stopColor={spec.leafColor}
                        stopOpacity={spec.leaf}
                    />
                    <Stop
                        offset='0.74'
                        stopColor={spec.leafColor}
                        stopOpacity={0}
                    />
                </RadialGradient>
            </Defs>
            <Rect
                x='0'
                y='0'
                width='100%'
                height='100%'
                fill={`url(#${id})`}
            />
        </Svg>
    );
}

/** A double helix for "Style DNA" — literal rather than abstract (was three
 *  overlapping color-swatch dots). No existing icon covers this concept, so
 *  it's kept local rather than growing the shared icon set for a single use.
 *  Carries the icon set's shared lime→leaf ramp so it reads as one family with
 *  TripFitIcon beside it. */
function StyleDnaGlyph({ size = 21 }: { size?: number }) {
    return (
        <Svg
            width={size}
            height={size}
            viewBox='0 0 24 24'
            fill='none'
            accessibilityElementsHidden
            importantForAccessibility='no'
        >
            <Defs>
                <SvgLinearGradient
                    id='dnaGrad'
                    x1='6'
                    y1='2'
                    x2='18'
                    y2='22'
                    gradientUnits='userSpaceOnUse'
                >
                    <Stop
                        offset='0'
                        stopColor={ICON_GRADIENT.from}
                    />
                    <Stop
                        offset='1'
                        stopColor={ICON_GRADIENT.to}
                    />
                </SvgLinearGradient>
            </Defs>
            <Path
                d='M12,2 C16,4 16,5 16,7 C16,9 12,10 12,12 C12,14 16,15 16,17 C16,19 16,20 12,22'
                stroke='url(#dnaGrad)'
                strokeWidth={1.7}
                strokeLinecap='round'
            />
            <Path
                d='M12,2 C8,4 8,5 8,7 C8,9 12,10 12,12 C12,14 8,15 8,17 C8,19 8,20 12,22'
                stroke='url(#dnaGrad)'
                strokeWidth={1.7}
                strokeLinecap='round'
            />
            <Line
                x1={8}
                y1={7}
                x2={16}
                y2={7}
                stroke='url(#dnaGrad)'
                strokeWidth={1.4}
                strokeLinecap='round'
            />
            <Line
                x1={8}
                y1={17}
                x2={16}
                y2={17}
                stroke='url(#dnaGrad)'
                strokeWidth={1.4}
                strokeLinecap='round'
            />
        </Svg>
    );
}

function FeatureRow({
    icon,
    title,
    body,
}: {
    icon: ReactNode;
    title: string;
    body: string;
}) {
    return (
        <GlassCard style={styles.featureRow}>
            <View style={styles.featureIconWrap}>{icon}</View>
            <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureBody}>{body}</Text>
            </View>
        </GlassCard>
    );
}

function PlanCard({
    label,
    priceString,
    unit,
    sub,
    badge = null,
    selected,
    onPress,
}: {
    label: string;
    priceString: string;
    unit: string;
    sub: string;
    badge?: string | null;
    selected: boolean;
    onPress: () => void;
}) {
    return (
        // Three nested layers, each doing one job the others can't:
        //   Pressable — the hit target, and the only thing the badge can overhang,
        //               since the clip below would otherwise cut it off.
        //   planFrame — the selection ring plus the clip that keeps the glass
        //               material inside the corner radius. GlassCard strips border
        //               styles on the native path so the ring cannot live on it.
        //   GlassCard — the surface itself: real iOS glass, or the translucent
        //               fallback everywhere else.
        <Pressable
            style={styles.planSlot}
            onPress={onPress}
            accessibilityRole='radio'
            accessibilityLabel={`${label}, ${priceString}`}
            accessibilityState={{ selected }}
        >
            <View
                style={[
                    styles.planFrame,
                    selected ? styles.planFrameOn : styles.planFrameOff,
                ]}
            >
                {/* Both cards keep the SAME material so they read as one control;
            only the tint and the ring change. Swapping the material for the
            selected one made the pair look like two different components. */}
                {/* No fill tint. Both cards are the same untinted material, so the
            glass keeps refracting instead of carrying a wash that reads as a
            scrim laid over it; selection is the ring plus the lime label and
            sub-line. Tried both a painted overlay and UIGlassEffect's own
            tintColor — at any strength strong enough to notice, a fill on a
            surface this small just flattens the material. */}
                <GlassCard style={styles.planCard}>
                    <Text
                        style={[
                            styles.planLabel,
                            selected && styles.planLabelOn,
                        ]}
                    >
                        {label}
                    </Text>
                    <View style={styles.planPriceRow}>
                        <Text style={styles.planPrice}>{priceString}</Text>
                        <Text style={styles.planUnit}>{unit}</Text>
                    </View>
                    <Text
                        style={[styles.planSub, selected && styles.planSubOn]}
                    >
                        {sub}
                    </Text>
                </GlassCard>
            </View>
            {badge ? (
                <LinearGradient
                    colors={['#4feec3', '#87DE5A']}
                    start={GRADIENT_START}
                    end={GRADIENT_END}
                    style={styles.planBadge}
                    pointerEvents='none'
                >
                    <Text style={styles.planBadgeText}>{badge}</Text>
                </LinearGradient>
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: INK_BASE },
    bloomBand: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: BLOOM_B_BAND,
    },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 20, gap: 14 },

    headerRow: { flexDirection: 'row', justifyContent: 'flex-end' },
    // 44×44 is the HIG minimum touch target; the glyph itself stays 16.
    closeBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.20)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    hero: { alignItems: 'center', gap: 8, paddingHorizontal: 10 },
    eyebrow: {
        fontFamily: fonts.bodySemiBold,
        fontSize: fontSizes.xs,
        letterSpacing: 3,
        color: 'rgba(255,255,255,0.92)',
        textTransform: 'uppercase',
    },
    headline: {
        fontFamily: fonts.display,
        fontSize: 30,
        lineHeight: 37,
        color: '#ffffff',
        textAlign: 'center',
    },
    subhead: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        lineHeight: 22,
        color: 'rgba(255,255,255,0.80)',
        textAlign: 'center',
        maxWidth: 292,
    },

    features: { gap: 10 },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 13,
        borderRadius: radius.md,
        padding: 13,
    },
    // A faint brand-tinted chip instead of the old 28%-white disc: on the dark
    // field the lime→leaf icons read against it at 4.2:1 rather than 1.3:1.
    featureIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(159,232,112,0.13)',
    },
    featureTextWrap: { flex: 1, gap: 3 },
    featureTitle: {
        fontFamily: fonts.bodySemiBold,
        fontSize: fontSizes.base,
        color: '#ffffff',
    },
    featureBody: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        lineHeight: 18,
        color: 'rgba(255,255,255,0.78)',
    },

    planRow: { flexDirection: 'row', gap: 10 },
    planSlot: { flex: 1 },
    // The ring and the corner clip live here rather than on the GlassCard: the
    // native path strips border styles so the material is not muddied, which
    // would take the selection state with it.
    planFrame: {
        borderRadius: radius.md,
        borderWidth: 1.5,
        overflow: 'hidden',
    },
    planFrameOn: { borderColor: 'rgba(159,232,112,0.72)' },
    // The design system's own glass edge (0.22) rather than the dimmer value
    // this started with: an unselected plan is still a live, tappable choice and
    // needs a defined edge. The selection hierarchy is carried by the mint hue,
    // not by starving the other card of contrast.
    planFrameOff: { borderColor: darkColors.glassBorder },
    planCard: {
        paddingTop: 14,
        paddingBottom: 12,
        paddingHorizontal: 12,
        alignItems: 'center',
        gap: 2,
    },
    planBadge: {
        position: 'absolute',
        top: -9,
        alignSelf: 'center',
        borderRadius: radius.pill,
        paddingVertical: 3,
        paddingHorizontal: 9,
    },
    planBadgeText: {
        fontFamily: fonts.bodyBold,
        fontSize: 9,
        letterSpacing: 0.8,
        color: INK_BASE,
    },
    planLabel: {
        fontFamily: fonts.bodySemiBold,
        fontSize: 10,
        letterSpacing: 1.5,
        color: 'rgba(255,255,255,0.72)',
        textTransform: 'uppercase',
        marginTop: 3,
    },
    planLabelOn: { color: 'rgba(200,255,120,0.95)' },
    planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    planPrice: { fontFamily: fonts.display, fontSize: 25, color: '#ffffff' },
    planUnit: {
        fontFamily: fonts.body,
        fontSize: 12,
        color: 'rgba(255,255,255,0.70)',
    },
    planSub: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: 'rgba(255,255,255,0.66)',
    },
    planSubOn: { color: 'rgba(200,255,120,0.85)' },

    planPlaceholder: {
        minHeight: 88,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        padding: spacing.sm,
    },
    singlePlan: {
        borderRadius: radius.md,
        padding: spacing.md,
        alignItems: 'center',
        gap: 4,
    },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    priceValue: { fontFamily: fonts.display, fontSize: 30, color: '#ffffff' },
    priceUnit: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        color: 'rgba(255,255,255,0.72)',
    },
    priceUnavailable: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
    },
    priceSub: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: 'rgba(255,255,255,0.68)',
        marginTop: 2,
    },

    ctaWrap: { gap: 8 },
    cta: {
        height: 54,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        // The button is the only full-strength brand surface on the screen; the
        // mint-tinted lift keeps its edge off the field at every point.
        shadowColor: '#4feec3',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 28,
        elevation: 8,
    },
    ctaDisabled: { opacity: 0.55 },
    ctaText: {
        fontFamily: fonts.bodyBold,
        fontSize: fontSizes.md,
        color: INK_BASE,
    },
    ctaSub: {
        fontFamily: fonts.body,
        fontSize: 12,
        color: 'rgba(255,255,255,0.72)',
        textAlign: 'center',
    },

    // A block rather than the old centred pill: these messages run to two or
    // three lines, which a pill shape handles badly.
    feedback: {
        borderRadius: radius.sm,
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    feedbackError: {
        backgroundColor: darkColors.dangerBg,
        borderColor: darkColors.dangerBorder,
    },
    // Deliberately NOT red: a pending payment and an "already subscribed" are
    // not failures, and dressing them as one is what makes people pay twice.
    feedbackInfo: {
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderColor: darkColors.glassBorder,
    },
    feedbackText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        lineHeight: 19,
        textAlign: 'center',
    },
    feedbackTextError: { color: darkColors.dangerTextHi },
    feedbackTextInfo: { color: 'rgba(255,255,255,0.92)' },

    restoreText: {
        fontFamily: fonts.bodyMedium,
        fontSize: fontSizes.sm,
        color: 'rgba(255,255,255,0.88)',
        textAlign: 'center',
    },

    legalWrap: { alignItems: 'center', gap: 6, marginTop: 2 },
    legalBody: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        lineHeight: 16,
        color: 'rgba(255,255,255,0.62)',
        textAlign: 'center',
        paddingHorizontal: 8,
    },
    legalLinksRow: { flexDirection: 'row', alignItems: 'center' },
    legalLink: {
        fontFamily: fonts.bodyMedium,
        fontSize: fontSizes.xs,
        color: 'rgba(255,255,255,0.80)',
    },
    legalDot: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: 'rgba(255,255,255,0.45)',
    },

    placeholderRoot: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    placeholderCard: {
        padding: spacing.lg,
        borderRadius: radius.md,
        alignItems: 'center',
        gap: spacing.sm,
    },
    placeholderTitle: {
        fontFamily: fonts.display,
        fontSize: fontSizes.lg,
        textAlign: 'center',
    },
    placeholderBody: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        textAlign: 'center',
        lineHeight: fontSizes.sm * 1.5,
    },
    placeholderBtn: {
        marginTop: spacing.xs,
        borderRadius: radius.sm,
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: spacing.md,
    },
    placeholderBtnText: {
        fontFamily: fonts.bodySemiBold,
        fontSize: fontSizes.sm,
    },
});
