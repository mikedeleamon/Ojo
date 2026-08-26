/**
 * PerfPanel — dev-only overlay for bisecting the WeatherHUD frame-rate problem.
 *
 * Renders nothing outside __DEV__. Collapsed it is a small pill in the bottom
 * corner; expanded it lists one switch per candidate bottleneck (see
 * lib/debug/perfFlags for what each one isolates).
 *
 * Use it with the RN perf monitor open — shake the device, then "Show Perf
 * Monitor" — and watch the UI row, not the JS row: everything under test here
 * (blur, fill rate, Core Animation compositing) is UI-thread work, and JS FPS
 * can sit at a happy 60 while the screen visibly stutters.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Switch } from 'react-native';
import { View, Text } from '../primitives';
import {
    PERF_FLAG_LABELS,
    resetPerfFlags,
    togglePerfFlag,
    usePerfFlags,
    type PerfFlags,
} from '../../lib/debug/perfFlags';

const KEYS = Object.keys(PERF_FLAG_LABELS) as (keyof PerfFlags)[];

const styles = StyleSheet.create({
    // Bottom-left, clear of the forecast strip and the details card so the
    // surfaces under test stay unobstructed while toggling.
    root: { position: 'absolute', left: 10, bottom: 96, zIndex: 999 },
    pill: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
    },
    pillText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    panel: {
        width: 208,
        padding: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.82)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        gap: 2,
    },
    title: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 9,
        letterSpacing: 1,
        marginBottom: 6,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 1,
    },
    label: { color: '#fff', fontSize: 12, flexShrink: 1 },
    labelOff: { color: 'rgba(255,140,120,0.95)', fontWeight: '600' },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.18)',
    },
    action: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
    // Full-size switches would push the panel wider than it needs to be.
    switch: { transform: [{ scaleX: 0.72 }, { scaleY: 0.72 }] },
});

export default function PerfPanel() {
    const flags = usePerfFlags();
    const [open, setOpen] = useState(false);

    if (!__DEV__) return null;

    const offCount = KEYS.filter((k) => !flags[k]).length;

    if (!open) {
        return (
            <View style={styles.root} pointerEvents='box-none'>
                <Pressable
                    style={styles.pill}
                    onPress={() => setOpen(true)}
                    accessibilityLabel='Open performance flags'
                >
                    <Text style={styles.pillText}>
                        {offCount > 0 ? `PERF · ${offCount} off` : 'PERF'}
                    </Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.root} pointerEvents='box-none'>
            <View style={styles.panel}>
                <Text style={styles.title}>ISOLATE A BOTTLENECK</Text>
                {KEYS.map((key) => (
                    <View key={key} style={styles.row}>
                        <Text
                            style={[
                                styles.label,
                                !flags[key] && styles.labelOff,
                            ]}
                        >
                            {PERF_FLAG_LABELS[key]}
                        </Text>
                        <Switch
                            style={styles.switch}
                            value={flags[key]}
                            onValueChange={() => togglePerfFlag(key)}
                        />
                    </View>
                ))}
                <View style={styles.footer}>
                    <Pressable onPress={resetPerfFlags} hitSlop={8}>
                        <Text style={styles.action}>Reset</Text>
                    </Pressable>
                    <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                        <Text style={styles.action}>Close</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}
