import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { GlassCard } from '../../components/primitives';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, fontSizes, radius, spacing } from '../../theme/tokens';

/** Centered chevron glyph for the month nav buttons. */
function NavChevron({ dir, color }: { dir: 'left' | 'right'; color: string }) {
    return (
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
            <Path
                d={dir === 'left' ? 'M10 3.5 5.5 8l4.5 4.5' : 'M6 3.5 10.5 8 6 12.5'}
                stroke={color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TripCalendarProps {
    startDate:      Date | null;
    endDate:        Date | null;
    onRangeChange:  (start: Date, end: Date | null) => void;
    maxDays?:       number;
    containerWidth: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth()    &&
           a.getDate()     === b.getDate();
}

function isPast(d: Date): boolean {
    return startOfDay(d) < startOfDay(new Date());
}

function isInRange(d: Date, start: Date, end: Date): boolean {
    const ds = startOfDay(d).getTime();
    return ds > startOfDay(start).getTime() && ds < startOfDay(end).getTime();
}

function addDays(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

/** 42-slot calendar grid (6 rows × 7 cols), Monday-first. null = padding cell. */
function buildCalendarDays(viewMonth: Date): (Date | null)[] {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0 … Sun=6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    // Pad to a multiple of 7
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
}

function fmtMonth(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TripCalendar({
    startDate,
    endDate,
    onRangeChange,
    maxDays = 10,
    containerWidth,
}: TripCalendarProps) {
    const { colors } = useTheme();

    const today = startOfDay(new Date());
    const [viewMonth, setViewMonth] = useState<Date>(
        () => new Date(today.getFullYear(), today.getMonth(), 1)
    );

    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const canGoBack = viewMonth > currentMonthStart;

    const cells = buildCalendarDays(viewMonth);
    const cellSize = Math.floor((containerWidth - spacing.md * 2) / 7);

    const handleDayPress = useCallback((day: Date) => {
        if (isPast(day)) return;

        if (!startDate || (startDate && endDate)) {
            onRangeChange(day, null);
            return;
        }

        if (isSameDay(day, startDate)) {
            onRangeChange(day, null);
            return;
        }

        const [rangeStart, rangeEnd] = day < startDate
            ? [day, startDate]
            : [startDate, day];

        const maxEnd = addDays(rangeStart, maxDays - 1);
        const clampedEnd = rangeEnd > maxEnd ? maxEnd : rangeEnd;
        onRangeChange(rangeStart, clampedEnd);
    }, [startDate, endDate, onRangeChange, maxDays]);

    const st = makeStyles(cellSize);

    return (
        <GlassCard style={st.container} glassStyle="regular">
            {/* Month header */}
            <View style={st.header}>
                <GlassCard
                    style={[st.navBtn, !canGoBack && st.navBtnHidden]}
                    glassStyle="clear"
                >
                    <Pressable
                        onPress={() => canGoBack && setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                        accessibilityRole="button"
                        accessibilityLabel="Previous month"
                        hitSlop={8}
                        style={st.navBtnInner}
                    >
                        <NavChevron dir="left" color={colors.textPrimary} />
                    </Pressable>
                </GlassCard>

                <Text style={[st.monthLabel, { color: colors.textPrimary }]}>
                    {fmtMonth(viewMonth)}
                </Text>

                <GlassCard style={st.navBtn} glassStyle="clear">
                    <Pressable
                        onPress={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                        accessibilityRole="button"
                        accessibilityLabel="Next month"
                        hitSlop={8}
                        style={st.navBtnInner}
                    >
                        <NavChevron dir="right" color={colors.textPrimary} />
                    </Pressable>
                </GlassCard>
            </View>

            {/* Day-of-week labels */}
            <View style={st.labelsRow}>
                {DAY_LABELS.map(label => (
                    <Text key={label} style={[st.dayLabel, { color: colors.textMuted, width: cellSize }]}>
                        {label}
                    </Text>
                ))}
            </View>

            {/* Calendar grid */}
            <View style={st.grid}>
                {cells.map((day, i) => {
                    if (!day) {
                        return <View key={`pad-${i}`} style={{ width: cellSize, height: cellSize * 0.9 }} />;
                    }

                    const isStart   = !!startDate && isSameDay(day, startDate);
                    const isEnd     = !!endDate   && isSameDay(day, endDate);
                    const inRange   = !!startDate && !!endDate && isInRange(day, startDate, endDate);
                    const isToday   = isSameDay(day, today);
                    const disabled  = isPast(day);
                    const selected  = isStart || isEnd;

                    return (
                        <Pressable
                            key={day.toISOString()}
                            onPress={() => handleDayPress(day)}
                            accessibilityRole="button"
                            accessibilityLabel={day.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                            accessibilityState={{ selected, disabled }}
                            style={[st.dayCell, { width: cellSize, height: cellSize * 0.9 }]}
                        >
                            {/* Range fill background */}
                            {inRange && (
                                <GlassCard
                                    glassStyle="clear"
                                    style={[
                                        st.rangeFill,
                                        { backgroundColor: colors.saveBtnBg + '33' },
                                    ]}
                                />
                            )}

                            {/* Selected dot */}
                            {selected && (
                                <View style={[st.selectedDot, { backgroundColor: colors.saveBtnBg }]} />
                            )}

                            {/* Today ring */}
                            {isToday && !selected && (
                                <View style={[st.todayRing, { borderColor: colors.saveBtnBg }]} />
                            )}

                            <Text
                                style={[
                                    st.dayText,
                                    { color: selected ? colors.saveBtnText : disabled ? colors.textMuted : colors.textPrimary },
                                    disabled && st.dayTextDisabled,
                                ]}
                            >
                                {day.getDate()}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Max-days hint */}
            <Text style={[st.hint, { color: colors.textMuted }]}>
                Select up to {maxDays} days
            </Text>
        </GlassCard>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(cellSize: number) {
    return StyleSheet.create({
        container: {
            borderRadius: radius.md,
            padding: spacing.sm,
            gap: spacing.xs,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.xs,
        },
        navBtn: {
            width: 32,
            height: 32,
            borderRadius: radius.pill,
            overflow: 'hidden',
        },
        navBtnHidden: {
            opacity: 0,
        },
        navBtnInner: {
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
        },
        monthLabel: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.base,
            textAlign: 'center',
        },
        labelsRow: {
            flexDirection: 'row',
            marginBottom: 2,
        },
        dayLabel: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            textAlign: 'center',
        },
        grid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
        },
        dayCell: {
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
        },
        rangeFill: {
            ...StyleSheet.absoluteFillObject,
            borderRadius: 0,
        },
        selectedDot: {
            position: 'absolute',
            width: cellSize * 0.72,
            height: cellSize * 0.72,
            borderRadius: cellSize * 0.36,
        },
        todayRing: {
            position: 'absolute',
            width: cellSize * 0.72,
            height: cellSize * 0.72,
            borderRadius: cellSize * 0.36,
            borderWidth: 1.5,
        },
        dayText: {
            fontFamily: fonts.bodyMedium,
            fontSize: fontSizes.sm,
            zIndex: 1,
        },
        dayTextDisabled: {
            opacity: 0.35,
        },
        hint: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            textAlign: 'center',
            marginTop: 4,
        },
    });
}
