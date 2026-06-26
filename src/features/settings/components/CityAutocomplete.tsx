/**
 * CityAutocomplete
 * ────────────────
 * A search field with a live dropdown of matching cities. The user must pick
 * a result from the dropdown to make a selection — typing alone never yields a
 * value — which guarantees only real cities flow out via `onSelect`.
 *
 * The dropdown renders inline (in normal layout flow, not absolutely) so it's
 * never clipped inside a ScrollView. Parents must keep
 * `keyboardShouldPersistTaps="handled"` on their ScrollView so a tap on a
 * suggestion registers before the keyboard dismisses.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { View, Text, Pressable } from '../../../components/primitives';
import { spacing, radius, fonts, fontSizes, fontWeights } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeContext';
import { searchCities, CitySuggestion } from '../../../lib/citySearch';

interface Props {
  /** Fires with the chosen city, or null whenever the user edits the text
   *  (which invalidates any prior pick and forces a fresh selection). */
  onSelect: (city: CitySuggestion | null) => void;
  placeholder?: string;
  /** Optional initial text (e.g. the current default city). */
  initialQuery?: string;
  /** Bump this number to clear the field (e.g. after a successful add). */
  resetSignal?: number;
  accessibilityLabel?: string;
  /** Called when the text input receives focus. */
  onInputFocus?: () => void;
}

export default function CityAutocomplete({
  onSelect,
  placeholder = 'Search for a city…',
  initialQuery = '',
  resetSignal = 0,
  accessibilityLabel = 'Search for a city',
  onInputFocus,
}: Props) {
  const { colors } = useTheme();
  const st = useMemo(
    () =>
      StyleSheet.create({
        input: {
          fontFamily: fonts.body,
          fontSize: fontSizes.base,
          color: colors.textPrimary,
          backgroundColor: colors.glassBg,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          borderRadius: radius.sm,
          paddingVertical: 12,
          paddingHorizontal: spacing.md,
        },
        dropdown: {
          marginTop: 4,
          backgroundColor: colors.glassBgStrong,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          borderRadius: radius.sm,
          overflow: 'hidden',
        },
        item: {
          paddingVertical: 10,
          paddingHorizontal: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.glassBorder,
          gap: 2,
        },
        itemName: {
          fontFamily: fonts.body,
          fontSize: fontSizes.base,
          fontWeight: fontWeights.semibold,
          color: colors.textPrimary,
        },
        itemSub: {
          fontFamily: fonts.body,
          fontSize: fontSizes.sm,
          color: colors.textMuted,
        },
        message: {
          paddingVertical: 12,
          paddingHorizontal: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        messageText: {
          fontFamily: fonts.body,
          fontSize: fontSizes.sm,
          color: colors.textMuted,
        },
      }),
    [colors],
  );

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<CitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  // True right after a pick so the debounce effect doesn't immediately
  // re-search the label text we just placed in the input.
  const justPicked = useRef(false);

  // Clear when the parent bumps resetSignal (skip the initial 0).
  useEffect(() => {
    if (resetSignal === 0) return;
    setQuery('');
    setResults([]);
    setOpen(false);
  }, [resetSignal]);

  // Debounced search.
  useEffect(() => {
    if (justPicked.current) { justPicked.current = false; return; }
    const q = query.trim();
    if (q.length < 2) { setResults([]); setLoading(false); setOpen(false); return; }

    setLoading(true);
    setOpen(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      const r = await searchCities(q, ctrl.signal);
      if (!ctrl.signal.aborted) { setResults(r); setLoading(false); }
    }, 300);

    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query]);

  const handleChange = (t: string) => {
    setQuery(t);
    onSelect(null); // editing invalidates any prior selection
  };

  const handlePick = (c: CitySuggestion) => {
    justPicked.current = true;
    setQuery(c.name);
    setResults([]);
    setOpen(false);
    onSelect(c);
  };

  const showEmpty = open && !loading && results.length === 0 && query.trim().length >= 2;

  return (
    <View>
      <TextInput
        style={st.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={handleChange}
        onFocus={() => { if (results.length) setOpen(true); onInputFocus?.(); }}
        autoCorrect={false}
        autoCapitalize="words"
        accessibilityLabel={accessibilityLabel}
      />
      {open && (loading || results.length > 0 || showEmpty) && (
        <View style={st.dropdown}>
          {results.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => handlePick(c)}
              style={st.item}
              accessibilityRole="button"
              accessibilityLabel={`Select ${c.label}`}
            >
              <Text style={st.itemName}>{c.name}</Text>
              <Text style={st.itemSub} numberOfLines={1}>{c.label}</Text>
            </Pressable>
          ))}
          {loading && (
            <View style={st.message}>
              <ActivityIndicator size="small" color={colors.textMuted} />
              <Text style={st.messageText}>Searching…</Text>
            </View>
          )}
          {showEmpty && (
            <View style={st.message}>
              <Text style={st.messageText}>No matching cities.</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
