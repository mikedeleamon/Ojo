/**
 * Platform-agnostic UI primitives.
 *
 * These components mirror React Native's core component API exactly.
 * On web they render standard HTML elements; in React Native you replace
 * this entire file with RN imports — consuming components need zero changes.
 *
 * ─── Migration instructions ─────────────────────────────────────────────────
 *
 * Delete this file and create a new one at the same path:
 *
 *   export {
 *     View, Text, TextInput, ScrollView, Image
 *   } from 'react-native';
 *   export { Pressable } from 'react-native';
 *
 * That's the entire migration for this layer. All props used here (onPress,
 * style, numberOfLines, secureTextEntry, etc.) are native RN props.
 *
 * ─── Prop alignment notes ───────────────────────────────────────────────────
 *
 * • onPress    — RN's universal tap handler (replaces onClick)
 * • style      — accepts a className string on web; on RN use StyleSheet objects
 * • disabled   — same on both platforms
 * • accessibilityLabel — maps to aria-label on web, native a11y on RN
 */

import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type StyleProp = string | undefined;   // className string on web; StyleSheet on RN

// ─── View ─────────────────────────────────────────────────────────────────────
// Maps to: <div>  →  RN: View

interface ViewProps {
  children?:           React.ReactNode;
  style?:              StyleProp;
  /** RN migration: maps to accessibilityLabel */
  accessibilityLabel?: string;
  /** RN migration: maps to testID */
  testID?:             string;
}

export const View = ({ children, style, accessibilityLabel, testID }: ViewProps) => (
  <div
    className={style}
    aria-label={accessibilityLabel}
    data-testid={testID}
  >
    {children}
  </div>
);

// ─── Text ─────────────────────────────────────────────────────────────────────
// Maps to: <span>  →  RN: Text

interface TextProps {
  children?:           React.ReactNode;
  style?:              StyleProp;
  /** Truncate after N lines. Web: single-line ellipsis when numberOfLines=1 */
  numberOfLines?:      number;
  accessibilityLabel?: string;
  testID?:             string;
  /** RN migration: maps to role="heading" / accessibilityRole */
  accessibilityRole?:  'header' | 'text' | 'none';
}

export const Text = ({
  children,
  style,
  numberOfLines,
  accessibilityLabel,
  testID,
  accessibilityRole,
}: TextProps) => (
  <span
    className={style}
    aria-label={accessibilityLabel}
    data-testid={testID}
    role={accessibilityRole === 'header' ? 'heading' : undefined}
    style={
      numberOfLines === 1
        ? { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
        : numberOfLines && numberOfLines > 1
          ? { display: '-webkit-box', WebkitLineClamp: numberOfLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
          : undefined
    }
  >
    {children}
  </span>
);

// ─── Pressable ────────────────────────────────────────────────────────────────
// Maps to: <button>  →  RN: Pressable (the modern unified touch handler)
//
// Why Pressable over TouchableOpacity?
//   Pressable is RN's current recommendation. It supports pressed-state
//   style callbacks: style={({ pressed }) => pressed && styles.pressed}
//   We don't implement that here (no hover state emulation needed on web)
//   but the prop shape is compatible.

interface PressableProps {
  children?:           React.ReactNode;
  onPress?:            () => void;
  style?:              StyleProp;
  disabled?:           boolean;
  accessibilityLabel?: string;
  accessibilityRole?:  'button' | 'link' | 'none';
  testID?:             string;
  /** RN migration: maps to hitSlop — ignored on web */
  hitSlop?:            number | { top?: number; bottom?: number; left?: number; right?: number };
}

export const Pressable = ({
  children,
  onPress,
  style,
  disabled,
  accessibilityLabel,
  testID,
}: PressableProps) => (
  <button
    className={style}
    onClick={disabled ? undefined : onPress}
    disabled={disabled}
    aria-label={accessibilityLabel}
    data-testid={testID}
    type="button"
  >
    {children}
  </button>
);

// ─── TextInput ────────────────────────────────────────────────────────────────
// Maps to: <input>  →  RN: TextInput

interface TextInputProps {
  value?:              string;
  onChangeText?:       (text: string) => void;
  placeholder?:        string;
  style?:              StyleProp;
  /** Hides characters — maps to type="password" on web */
  secureTextEntry?:    boolean;
  /** Maps to type="email-address" keyboard on RN, type="email" on web */
  keyboardType?:       'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?:     'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?:        boolean;
  editable?:           boolean;
  onSubmitEditing?:    () => void;
  accessibilityLabel?: string;
  testID?:             string;
  /** RN: returnKeyType — maps to onKeyDown Enter on web */
  returnKeyType?:      'done' | 'go' | 'next' | 'search' | 'send';
}

export const TextInput = ({
  value,
  onChangeText,
  placeholder,
  style,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  editable = true,
  onSubmitEditing,
  accessibilityLabel,
  testID,
}: TextInputProps) => {
  const inputType = secureTextEntry
    ? 'password'
    : keyboardType === 'email-address'
      ? 'email'
      : keyboardType === 'numeric' || keyboardType === 'phone-pad'
        ? 'number'
        : 'text';

  return (
    <input
      type={inputType}
      value={value}
      onChange={e => onChangeText?.(e.target.value)}
      placeholder={placeholder}
      className={style}
      disabled={!editable}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect !== false ? 'on' : 'off'}
      aria-label={accessibilityLabel}
      data-testid={testID}
      onKeyDown={e => { if (e.key === 'Enter') onSubmitEditing?.(); }}
    />
  );
};

// ─── ScrollView ───────────────────────────────────────────────────────────────
// Maps to: <div> with overflow scroll  →  RN: ScrollView

interface ScrollViewProps {
  children?:           React.ReactNode;
  style?:              StyleProp;
  /** RN: horizontal ScrollView — maps to overflow-x on web */
  horizontal?:         boolean;
  /** RN: show/hide scrollbar */
  showsVerticalScrollIndicator?:   boolean;
  showsHorizontalScrollIndicator?: boolean;
  accessibilityLabel?: string;
  testID?:             string;
}

export const ScrollView = ({
  children,
  style,
  horizontal,
  accessibilityLabel,
  testID,
}: ScrollViewProps) => (
  <div
    className={style}
    aria-label={accessibilityLabel}
    data-testid={testID}
    style={{
      overflowX: horizontal ? 'auto' : 'hidden',
      overflowY: horizontal ? 'hidden' : 'auto',
      WebkitOverflowScrolling: 'touch',
    }}
  >
    {children}
  </div>
);

// ─── Image ────────────────────────────────────────────────────────────────────
// Maps to: <img>  →  RN: Image

interface ImageProps {
  /** RN uses source={{ uri: '...' }} or require('./image.png') */
  source:              { uri: string } | number;
  style?:              StyleProp;
  /** RN: resizeMode — maps to object-fit on web */
  resizeMode?:         'cover' | 'contain' | 'stretch' | 'center';
  accessibilityLabel?: string;
  testID?:             string;
}

export const Image = ({
  source,
  style,
  resizeMode = 'cover',
  accessibilityLabel,
  testID,
}: ImageProps) => {
  const uri = typeof source === 'number'
    ? String(source)           // RN static require — on web this won't be used the same way
    : source.uri;

  const objectFit: React.CSSProperties['objectFit'] =
    resizeMode === 'stretch' ? 'fill' :
    resizeMode === 'center'  ? 'none' :
    resizeMode;

  return (
    <img
      src={uri}
      className={style}
      alt={accessibilityLabel ?? ''}
      data-testid={testID}
      style={{ objectFit }}
    />
  );
};

// ─── Barrel export ────────────────────────────────────────────────────────────

export default { View, Text, TextInput, Pressable, ScrollView, Image };
