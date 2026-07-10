import { StyleSheet } from 'react-native';
import { fonts } from '../../theme/tokens';
import { RECAP_PALETTE as P } from '../../lib/recapVisuals';

/**
 * The redesigned Weekly Recap runs on its own always-dark surface, so these
 * styles hard-code the recap palette rather than reading ThemeContext. Type
 * roles map DM Serif Display → serif-hero/serif-head and Outfit-SemiBold →
 * eyebrow/stamp, per the 2026-07 redesign.
 */
export default StyleSheet.create({
  root: { flex: 1, backgroundColor: P.ink },
  content: { paddingHorizontal: 18, paddingBottom: 48, gap: 14 },

  // ── Nav row ────────────────────────────────────────────────────────────────
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 10,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.hairline,
  },
  navBtnText: { color: P.text, fontFamily: fonts.bodyMedium, fontSize: 16 },
  navStamp: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: P.muted,
  },

  // ── Masthead ─────────────────────────────────────────────────────────────
  masthead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  mastheadKicker: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: P.muted,
    marginBottom: 6,
  },
  hairline: { height: 1, backgroundColor: P.hairline, marginBottom: 4 },

  // ── Card shell ───────────────────────────────────────────────────────────
  card: {
    borderRadius: 26,
    paddingVertical: 22,
    paddingHorizontal: 20,
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.hairline,
    overflow: 'hidden',
    gap: 8,
  },
  cardGradient: { ...StyleSheet.absoluteFillObject },

  // ── Type roles ───────────────────────────────────────────────────────────
  eyebrow: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: P.mint,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: P.text,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    lineHeight: 21,
    color: P.muted,
  },
  serifItalic: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 18,
    color: P.muted,
  },
  stamp: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: P.muted,
  },

  // ── Hero ─────────────────────────────────────────────────────────────────
  // RN clips a glyph to its line box, so `lineHeight` must clear the font's
  // full ascent+descent — the spec's CSS line-height of 0.85 sheared the tops
  // off the numerals. Keep it >= fontSize and pull the optical gap back with
  // negative margins instead.
  heroNumberRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  heroNumber: {
    fontFamily: fonts.display,
    fontSize: 104,
    lineHeight: 118,
    includeFontPadding: false,
    letterSpacing: -3,
    color: P.text,
    marginBottom: -14,
  },
  heroHeadline: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.4,
    color: P.text,
    marginTop: 14,
  },

  // ── Big stat number (color / mvp / all-time) ──────────────────────────────
  statNumber: {
    fontFamily: fonts.display,
    fontSize: 62,
    lineHeight: 72,
    includeFontPadding: false,
    letterSpacing: -1.5,
    marginBottom: -8,
  },

  // ── Section headers within cards ───────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  swatchRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  swatchDot: { width: 16, height: 16, borderRadius: 8 },

  // ── CTA ────────────────────────────────────────────────────────────────────
  ctaBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: P.hairline,
  },
  ctaBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: P.text },
});
