import { useLayoutEffect, useMemo } from 'react';
import { useNavigation } from 'expo-router';
import { useSideRail } from './useSideRail';

export interface SideColumnBack {
    /** Shown under the icon in the side column; also the VoiceOver name. */
    label: string;
    onPress: () => void;
    /** Icon and label colour; defaults to white for screens on a dark field. */
    tintColor?: string;
    /** 'home' shows a house instead of the back chevron (the item goes Home). */
    kind?: 'back' | 'home';
}

export interface SideColumnAction {
    label: string;
    /** SF Symbol name, e.g. 'plus'. */
    sfSymbol: string;
    onPress: () => void;
    tintColor?: string;
    /** 'prominent' draws a filled button in tintColor (iOS 26+). */
    variant?: 'plain' | 'prominent';
}

/**
 * iPhone Duo: put one of this screen's page buttons in the side column.
 *
 * The Duo HIG moves the nav-bar buttons into the side column with the tab rail,
 * so a button drawn inside the page breaks the layout. This shows the screen's
 * native Stack header (transparent, untitled; it exists only to carry the item)
 * with one item, which iOS then places in the side column. Hide the page's own
 * button whenever this is active (useSideRail()).
 *
 * Only for screens whose header is otherwise hidden, and one item per screen:
 * on cleanup the header is hidden again. Pass null to show nothing (e.g. while
 * there's nowhere to go back to, or when the caller isn't a Stack screen).
 * Memoize the item so the native button isn't rebuilt every render.
 *
 * On any other device this does nothing.
 */
function useSideColumnItem(
    side: 'left' | 'right',
    item: SideColumnAction | null,
): void {
    const navigation = useNavigation();
    const sideRail = useSideRail();
    const active = sideRail && item !== null;

    useLayoutEffect(() => {
        if (!active || !item) return;
        const items = () => [
            {
                type: 'button',
                label: item.label,
                icon: { type: 'sfSymbol', name: item.sfSymbol },
                tintColor: item.tintColor ?? 'rgba(255,255,255,0.85)',
                variant: item.variant ?? 'plain',
                onPress: item.onPress,
            },
        ];
        navigation.setOptions({
            headerShown: true,
            headerTransparent: true,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: 'transparent' },
            headerLeft: undefined,
            headerBackVisible: false,
            title: '',
            ...(side === 'left'
                ? { unstable_headerLeftItems: items }
                : { unstable_headerRightItems: items }),
        } as never);
        return () => {
            navigation.setOptions({
                headerShown: false,
                unstable_headerLeftItems: undefined,
                unstable_headerRightItems: undefined,
            } as never);
        };
    }, [active, item, side, navigation]);
}

/** A back (or Home) button in the Duo side column. See useSideColumnItem. */
export function useSideColumnBack(back: SideColumnBack | null): void {
    // Rebuilt only when the caller's memoized `back` changes.
    const item = useMemo<SideColumnAction | null>(
        () =>
            back && {
                label: back.label,
                sfSymbol: back.kind === 'home' ? 'house' : 'chevron.left',
                onPress: back.onPress,
                tintColor: back.tintColor,
            },
        [back],
    );
    useSideColumnItem('left', item);
}

/** An action (e.g. Add) in the Duo side column. See useSideColumnItem. */
export function useSideColumnAction(action: SideColumnAction | null): void {
    useSideColumnItem('right', action);
}
