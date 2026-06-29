import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useClosets } from '../../hooks/useClosets';
import { useSettings } from '../../context/SettingsContext';
import { useTripPlans } from '../../hooks/useTripPlans';
import type { ClothingArticle, SavedTripFitPlan } from '../../types';
import TripLibrary from './TripLibrary';
import TripPlanner, { type PlannerPrefill } from './TripPlanner';

type Mode =
    | { kind: 'library' }
    | { kind: 'planner'; existing?: SavedTripFitPlan; prefill?: PlannerPrefill };

/**
 * TripFit entry point. Owns the saved-trip library and swaps in the planner
 * for creating a new trip, planning from an imported flight, or opening a
 * saved one. All persistence flows through `useTripPlans`.
 */
export default function TripFitScreen() {
    const router = useRouter();
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

    if (mode.kind === 'planner') {
        return (
            <TripPlanner
                articles={articles}
                closetId={closetId}
                settings={settings}
                existingPlan={mode.existing}
                prefill={mode.prefill}
                onBack={openLibrary}
                onPersist={upsert}
                onDeleted={handleDeleted}
            />
        );
    }

    return (
        <TripLibrary
            plans={plans}
            loading={loading}
            onNew={() => setMode({ kind: 'planner' })}
            onOpen={(plan) => setMode({ kind: 'planner', existing: plan })}
            onDelete={remove}
            onPlanFromAirline={(prefill) => setMode({ kind: 'planner', prefill })}
            onBackToCloset={() => router.replace('/(tabs)/closet')}
        />
    );
}
