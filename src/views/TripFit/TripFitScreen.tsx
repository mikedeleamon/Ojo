import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useClosets } from '../../hooks/useClosets';
import { useSettings } from '../../context/SettingsContext';
import { useTripPlans } from '../../hooks/useTripPlans';
import type { ClothingArticle, SavedTripFitPlan } from '../../types';
import TripLibrary from './TripLibrary';
import TripPlanner, { type PlannerPrefill } from './TripPlanner';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanePlaceholder } from '../../components/layout/PanePlaceholder';
import { tripFitStatus } from './shared';
import { useFoldLayout } from '../../context/FoldLayoutContext';
import { useTheme } from '../../theme/ThemeContext';

type Mode =
    | { kind: 'library' }
    | { kind: 'planner'; existing?: SavedTripFitPlan; prefill?: PlannerPrefill };

/**
 * TripFit entry point — the `tripfit` tab. Owns the saved-trip library and
 * swaps in the planner for creating a new trip, planning from an imported
 * flight, or opening a saved one. All persistence flows through `useTripPlans`.
 *
 * As a root tab this screen has nothing to go "back" to, so the library
 * renders without a back chevron (see TripLibrary's optional `onBack`).
 */
export default function TripFitScreen() {
    const { colors } = useTheme();
    const fold = useFoldLayout();
    const twoPane = fold.mode === 'two-pane' && fold.axis === 'row';
    const { right: rightInset } = useSafeAreaInsets();
    const { closets } = useClosets();
    const { settings } = useSettings();
    const { plans, loading, upsert, remove } = useTripPlans();

    const [mode, setMode] = useState<Mode>({ kind: 'library' });

    // Deep-link: the Trip Mode card opens a specific trip via ?planId=. Handle
    // each id once (via a ref) so returning to the library doesn't reopen it.
    const { planId } = useLocalSearchParams<{ planId?: string }>();
    const handledPlanId = useRef<string | null>(null);
    useEffect(() => {
        if (!planId || loading || handledPlanId.current === planId) return;
        const plan = plans.find((p) => p.id === planId);
        if (plan) {
            handledPlanId.current = planId;
            setMode({ kind: 'planner', existing: plan });
        }
    }, [planId, loading, plans]);

    // Build outfits from the user's preferred closet (falling back to the first).
    const { articles, closetId } = useMemo(() => {
        if (!closets.length) return { articles: [] as ClothingArticle[], closetId: '' };
        const preferred = closets.find((c) => c.isPreferred) ?? closets[0];
        return { articles: preferred.articles, closetId: preferred._id };
    }, [closets]);

    const openLibrary = useCallback(() => setMode({ kind: 'library' }), []);

    const handleDeleted = useCallback(
        async (id: string) => {
            await remove(id);
            setMode({ kind: 'library' });
        },
        [remove],
    );

    const isPlanner = mode.kind === 'planner';

    // Two panes always show a trip on the right: the one opened, else the next
    // upcoming one, else the latest past one. Derived rather than stored, so a
    // fold back to one column returns to the library instead of a trip.
    const shownPlan = useMemo(() => {
        if (mode.kind === 'planner' || !twoPane || !plans.length) return null;
        const upcoming = plans
            .filter((p) => tripFitStatus(p) !== 'completed')
            .sort((a, b) => a.startDate.localeCompare(b.startDate));
        if (upcoming.length) return upcoming[0];
        return [...plans].sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
    }, [mode.kind, twoPane, plans]);
    const planner =
        mode.kind === 'planner'
            ? mode
            : shownPlan
              ? { existing: shownPlan, prefill: undefined }
              : null;
    const selectedId = twoPane
        ? (mode.kind === 'planner' ? mode.existing?.id : shownPlan?.id)
        : undefined;

    // Both stay mounted in every layout. In two panes they sit side by side; in
    // one column the library is hidden while the planner is open. Keeping the
    // same tree is what stops a fold from wiping a half-planned trip.
    return (
        <View style={{ flex: 1, flexDirection: twoPane ? 'row' : 'column', paddingRight: twoPane ? 0 : rightInset, backgroundColor: colors.bgDefault }}>
            <View
                style={[
                    twoPane && fold.panes ? { width: fold.panes.primary.width } : { flex: 1 },
                    !twoPane && isPlanner && { display: 'none' },
                ]}
            >
                <TripLibrary
                    plans={plans}
                    loading={loading}
                    onNew={() => setMode({ kind: 'planner' })}
                    onOpen={(plan) => setMode({ kind: 'planner', existing: plan })}
                    onDelete={remove}
                    onPlanFromAirline={(prefill) => setMode({ kind: 'planner', prefill })}
                    selectedId={selectedId}
                />
            </View>
            {(isPlanner || twoPane) && (
                <View style={{ flex: 1, paddingRight: twoPane ? rightInset : 0, backgroundColor: colors.bgDefault }}>
                    {planner ? (
                        <TripPlanner
                            // A preview remounts as the real thing when tapped,
                            // so opening it still runs the opening work.
                            key={`${planner.existing?.id ?? 'new'}${mode.kind === 'planner' ? '' : ':preview'}`}
                            autoGenerate={mode.kind === 'planner'}
                            articles={articles}
                            closetId={closetId}
                            settings={settings}
                            existingPlan={planner.existing}
                            prefill={planner.prefill}
                            savedPlans={plans}
                            onBack={openLibrary}
                            onPersist={upsert}
                            onDeleted={handleDeleted}
                        />
                    ) : (
                        <PanePlaceholder message="Plan a trip and its day-by-day outfits and packing list open here." />
                    )}
                </View>
            )}
        </View>
    );
}
