import SwiftUI
import WidgetKit

// Ojo brand green (#87DE5A), used as the accent for the trip badge.
extension Color {
  static let ojoAccent = Color(red: 0x87 / 255, green: 0xDE / 255, blue: 0x5A / 255)
}

/// The Home Screen widget's background is the local-weather gradient (see
/// WeatherGradient), with a dark scrim so white text stays legible regardless
/// of which gradient is active — mirrors WeatherHUD's white-on-gradient
/// convention in the main app rather than computing per-gradient contrast.
/// Empty state has no weather point of reference, so it stays on a neutral
/// system background.
///
/// Lock Screen accessory families (.accessoryRectangular/.accessoryInline) are
/// composited by the system with its own vibrancy/tint — a custom background
/// there would fight that rendering, so they stay fully transparent.
///
/// iOS 17 requires widgets to declare their background via `containerBackground`;
/// falls back to a plain `.background()` on 16.
extension View {
  @ViewBuilder
  func ojoWidgetBackground(_ snapshot: WidgetSnapshot, family: WidgetFamily) -> some View {
    if family == .accessoryRectangular || family == .accessoryInline || family == .accessoryCircular {
      if #available(iOS 17.0, *) {
        containerBackground(for: .widget) { Color.clear }
      } else {
        self
      }
    } else if snapshot.mode == .empty && snapshot.weatherKind == nil {
      // Empty state with NO weather captured → neutral background (nothing to
      // theme from). When weather IS present it falls through to the gradient
      // below, so the empty state keeps the same weather backdrop as an outfit.
      if #available(iOS 17.0, *) {
        containerBackground(for: .widget) { Color(.systemBackground) }
      } else {
        background(Color(.systemBackground))
      }
    } else {
      let gradient = LinearGradient(
        colors: WeatherGradient.colors(kind: snapshot.weatherKind, isDay: snapshot.isDay),
        startPoint: .top,
        endPoint: .bottom
      )
      if #available(iOS 17.0, *) {
        containerBackground(for: .widget) {
          gradient.overlay(Color.black.opacity(0.16))
        }
      } else {
        background(gradient.overlay(Color.black.opacity(0.16)))
      }
    }
  }
}

// MARK: - Root

struct OjoWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: OjoProvider.Entry

  var body: some View {
    content
      .widgetURL(URL(string: entry.snapshot.deepLink))
      .ojoWidgetBackground(entry.snapshot, family: family)
  }

  @ViewBuilder private var content: some View {
    let snap = entry.snapshot
    switch family {
    case .accessoryCircular:
      LockScreenCircularView(snap: snap)
    case .accessoryRectangular:
      LockScreenRectangularView(snap: snap)
    case .accessoryInline:
      LockScreenInlineView(snap: snap)
    default:
      switch snap.mode {
      case .empty:
        EmptyStateView(snap: snap)
      case .today, .trip:
        switch family {
        case .systemSmall:
          SmallOutfitView(snap: snap)
        case .systemLarge, .systemExtraLarge:
          LargeOutfitView(snap: snap)
        default:
          MediumOutfitView(snap: snap)
        }
      }
    }
  }
}

// MARK: - Thumbnail

/// Loads a cached garment thumbnail from the App Group; shows a translucent
/// glass-style tile (matching the app's GlassCard look) when uncached.
struct ThumbView: View {
  let item: WidgetSnapshot.Item

  var body: some View {
    ZStack {
      if let url = SnapshotStore.thumbURL(item.thumb),
         let data = try? Data(contentsOf: url),
         let ui = UIImage(data: data) {
        Image(uiImage: ui)
          .resizable()
          .aspectRatio(contentMode: .fill)
      } else {
        Rectangle()
          .fill(Color.white.opacity(0.16))
          .overlay(
            Image(systemName: "photo")
              .font(.system(size: 15))
              .foregroundStyle(.white.opacity(0.7))
          )
      }
    }
    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
  }
}

// MARK: - Shared pieces — text sits on the weather gradient, so everything
// below uses white at varying opacity (mirrors WeatherHUD's on-gradient scale)
// rather than semantic colors like .primary/.secondary.

struct TripBadge: View {
  let trip: WidgetSnapshot.TripInfo

  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: trip.locationConfirmed ? "location.fill" : "airplane")
        .font(.system(size: 9))
      Text("Day \(trip.dayIndex) of \(trip.dayTotal) · \(trip.destination)")
        .font(.system(size: 11, weight: .semibold))
        .lineLimit(1)
    }
    .foregroundStyle(Color.ojoAccent)
  }
}

private func headlineText(_ snap: WidgetSnapshot) -> String {
  snap.headline.isEmpty ? "Today's Outfit" : snap.headline
}

// MARK: - Weather icon

/// The Home Screen widget's weather glyph — one of the 8 custom Ojo brand
/// icons bundled in Assets.xcassets (mirrors src/assets/images/weatherIcons).
/// Lock Screen views use WeatherGradient.sfSymbolName instead: those families
/// are vibrancy/tint composited by the system and can't render full-color art.
struct WeatherIconView: View {
  let kind: String?
  let isDay: Bool?
  var size: CGFloat = 18

  var body: some View {
    Image(WeatherGradient.iconAssetName(kind: kind, isDay: isDay))
      .resizable()
      .aspectRatio(contentMode: .fit)
      .frame(width: size, height: size)
  }
}

// MARK: - Hero temperature (the glance's largest element)

/// The redesigned hierarchy leads with the temperature — large, rounded,
/// monospaced digits, white on the weather gradient. Falls back to the legacy
/// `tempLine` string for snapshots written before the structured weather block.
struct TempHeroView: View {
  let snap: WidgetSnapshot
  var size: CGFloat = 40

  var body: some View {
    if let w = snap.weather {
      Text("\(w.temp)°")
        .font(.system(size: size, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(.white)
    } else if let t = snap.tempLine, !t.isEmpty {
      Text(t)
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(.white)
    }
  }
}

/// The active city — the header's top line in the redesigned layout (Apple
/// Weather widget convention: city on top, big temperature below). Shown only
/// in today/empty modes; trip mode's TripBadge already names the destination,
/// and the small family omits it entirely (one glance, tightest space).
struct CityLabel: View {
  let snap: WidgetSnapshot
  var size: CGFloat = 11
  var weight: Font.Weight = .semibold

  var body: some View {
    if snap.mode != .trip, let city = snap.weather?.city, !city.isEmpty {
      Text(city)
        .font(.system(size: size, weight: weight))
        .foregroundStyle(.white.opacity(0.85))
        .lineLimit(1)
    }
  }
}

/// "Feels 74° · Clear · H:78° L:61°" — the hero temperature's supporting line.
/// Degrades gracefully: missing pieces are dropped, and a snapshot without the
/// weather block falls back to the legacy `tempLine`. `includeFeelsLike` is off
/// for the medium family, which has a narrower left column.
func weatherMetaLine(
  _ snap: WidgetSnapshot,
  includeFeelsLike: Bool = true,
  includeHighLow: Bool = true
) -> String? {
  guard let w = snap.weather else { return snap.tempLine }
  var parts: [String] = []
  if includeFeelsLike, let f = w.feelsLike { parts.append("Feels \(f)°") }
  if let c = w.condition, !c.isEmpty { parts.append(c) }
  if includeHighLow, let h = w.high, let l = w.low { parts.append("H:\(h)° L:\(l)°") }
  return parts.isEmpty ? snap.tempLine : parts.joined(separator: " · ")
}

// MARK: - Signal chips (weather signals + accessory gaps, one merged row)

/// One frosted capsule — white-on-translucent so it reads on any of the
/// weather gradients (the spec's orange/blue-tinted chips assume a light
/// surface and would vanish against the dark scrim).
private struct SignalChip: View {
  let symbol: String
  let text: String

  var body: some View {
    HStack(spacing: 3) {
      Image(systemName: symbol)
        .font(.system(size: 8, weight: .semibold))
      Text(text)
        .font(.system(size: 9, weight: .semibold))
        .tracking(0.4)
    }
    .padding(.horizontal, 7)
    .padding(.vertical, 3)
    .background(Capsule().fill(Color.white.opacity(0.18)))
    .foregroundStyle(.white)
    .lineLimit(1)
  }
}

private struct ChipSpec: Identifiable {
  let id: String
  let symbol: String
  let text: String
}

/// Merges the ambient weather signals (rain %, high UV) with the outfit-gap
/// alerts (missing layer / boots) into one chip row, replacing the old glyph
/// row so the same signal can't appear twice. Priority mirrors the old alert
/// order: rain first (most likely to catch you out), UV last.
private func signalChips(_ snap: WidgetSnapshot, maxCount: Int) -> [ChipSpec] {
  var chips: [ChipSpec] = []
  let alerts = Set(snap.alerts ?? [])

  // Rain: the daily chance when known (ambient signal, per the spec), else
  // only when the outfit-gap alert fired.
  if let rc = snap.weather?.rainChance, rc >= 20 {
    chips.append(ChipSpec(id: "rain", symbol: "umbrella.fill", text: "RAIN \(rc)%"))
  } else if alerts.contains("rain") {
    chips.append(ChipSpec(id: "rain", symbol: "umbrella.fill", text: "RAIN"))
  }
  if alerts.contains("layer") {
    chips.append(ChipSpec(id: "layer", symbol: "tshirt.fill", text: "LAYER UP"))
  }
  if alerts.contains("snow") {
    chips.append(ChipSpec(id: "snow", symbol: "snowflake", text: "BOOTS"))
  }
  // UV: category text ("UV VERY HIGH"), same wording as the app's "UV Index"
  // stat — shown whenever the day is High+, not just when a hat is missing.
  if let uv = snap.uvIndexText ?? snap.weather?.uvText,
     ["High", "Very High", "Extreme"].contains(uv) {
    chips.append(ChipSpec(id: "uv", symbol: "sun.max.fill", text: "UV \(uv.uppercased())"))
  }
  return Array(chips.prefix(maxCount))
}

struct SignalChipsView: View {
  let snap: WidgetSnapshot
  var maxCount: Int = 3

  var body: some View {
    let chips = signalChips(snap, maxCount: maxCount)
    if !chips.isEmpty {
      HStack(spacing: 5) {
        ForEach(chips) { SignalChip(symbol: $0.symbol, text: $0.text) }
      }
    }
  }
}

/// The outfit's plain-language description — layeringEngine's `recommendation`,
/// e.g. "Your white tee is all you need today." Always shown when present; it's
/// the widget's core "what to wear" answer and doesn't depend on there being
/// multiple layers. Separate from WeatherCuesView (which is only weather
/// *warnings*) so a UV/rain glyph never suppresses the description.
struct OutfitDescriptionView: View {
  let snap: WidgetSnapshot
  var lineLimit: Int = 2

  var body: some View {
    if let note = snap.layerNote, !note.isEmpty {
      Text(note)
        .font(.system(size: 10, weight: .medium))
        .foregroundStyle(.white.opacity(0.85))
        .lineLimit(lineLimit)
        .fixedSize(horizontal: false, vertical: true)
    }
  }
}

/// Weather cues that ADD to the description: a same-day timeline strip (rarer,
/// more specific — see TimelineStripView) or the merged signal-chip row (rain %
/// / UV / accessory gaps — see SignalChipsView). One row of vertical budget:
/// the timeline wins on the rare days it exists, since it already conveys the
/// rain start/stop the chips would.
struct WeatherCuesView: View {
  let snap: WidgetSnapshot
  var maxAlerts: Int = 3
  var showTimeline: Bool = true

  var body: some View {
    if showTimeline, let timeline = snap.timeline, !timeline.isEmpty {
      TimelineStripView(steps: timeline)
    } else {
      SignalChipsView(snap: snap, maxCount: maxAlerts)
    }
  }
}

// MARK: - Timeline strip (same-day layer changes)

/// Maps a timeline step's `action` text to an icon by matching layeringEngine's
/// small, fixed set of template prefixes (see buildTimeline in layeringEngine.ts)
/// — keying off known app-authored copy, not open-ended text parsing.
/// Internal (not private): the Layer Timeline widget's rows use the same match.
func timelineActionIcon(_ action: String) -> String {
  if action.hasPrefix("Remove")      { return "minus.circle.fill" }
  if action.hasPrefix("Add")         { return "plus.circle.fill" }
  if action.hasPrefix("Rain starts") { return "cloud.rain.fill" }
  if action.hasPrefix("Rain clears") { return "sun.max.fill" }
  if action.hasPrefix("Keep your")   { return "checkmark.circle.fill" }
  return "clock.fill"
}

/// A compact same-day sequence from layeringEngine's buildTimeline, e.g.
/// "Afternoon → Evening" with an icon per step showing what changes. Distinct
/// from the plain recommendation sentence: this shows WHEN advice shifts
/// during the day, which a single static line can't convey. Rendered via
/// WeatherCuesView (the compact hint line + the large widget's cues row).
struct TimelineStripView: View {
  let steps: [WidgetSnapshot.TimelineStep]

  var body: some View {
    HStack(spacing: 4) {
      ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
        if index > 0 {
          Image(systemName: "chevron.right")
            .font(.system(size: 8, weight: .bold))
            .foregroundStyle(.white.opacity(0.5))
        }
        HStack(spacing: 3) {
          Image(systemName: timelineActionIcon(step.action))
            .font(.system(size: 10, weight: .semibold))
          Text(step.time)
            .font(.system(size: 10, weight: .semibold))
        }
      }
    }
    .foregroundStyle(.white.opacity(0.9))
  }
}

// MARK: - Outfit thumbnail row

/// A row of portrait garment tiles — the original look: each tile keeps a fixed
/// aspect ratio (`.fit`) so clothing photos aren't stretched or cropped into
/// landscape. `maxHeight` optionally caps the tile height on the large widget so
/// they don't balloon; small/medium leave it nil and let the tiles size to the
/// row's available space (matching the placeholder layout).
struct OutfitThumbRow: View {
  let items: [WidgetSnapshot.Item]
  var maxCount: Int
  var ratio: CGFloat = 0.8
  var spacing: CGFloat = 6
  var maxHeight: CGFloat? = nil
  /// Floor so tiles can't get squeezed toward invisible under vertical
  /// pressure from sibling content (the original items-disappeared bug) —
  /// shape/proportion still comes from `aspectRatio`, this only guarantees a
  /// minimum, it doesn't change normal sizing.
  var minHeight: CGFloat? = nil

  var body: some View {
    HStack(spacing: spacing) {
      ForEach(Array(items.prefix(maxCount))) { item in
        ThumbView(item: item)
          .aspectRatio(ratio, contentMode: .fit)
          .frame(minHeight: minHeight)
      }
    }
    .frame(maxHeight: maxHeight)
  }
}

/// The compact single hint line for the small widget — shows the weather cues
/// (timeline strip or signal chips) when there's something to flag, otherwise
/// the outfit description. One line only, so the layout stays glanceable.
struct CompactHintView: View {
  let snap: WidgetSnapshot
  var maxAlerts: Int = 3

  private var hasCues: Bool {
    (snap.timeline?.isEmpty == false) || !signalChips(snap, maxCount: 1).isEmpty
  }

  var body: some View {
    if hasCues {
      WeatherCuesView(snap: snap, maxAlerts: maxAlerts)
    } else {
      OutfitDescriptionView(snap: snap, lineLimit: 1)
    }
  }
}

// MARK: - Medium

/// HStack split: the weather reading on the left (hero temperature, meta line,
/// description, cues), the outfit on the right — the spec's medium layout on
/// the brand gradient. The description keeps its always-on slot (it's the core
/// "what to wear" answer); the cues row is the merged chips or timeline.
struct MediumOutfitView: View {
  let snap: WidgetSnapshot

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      VStack(alignment: .leading, spacing: 4) {
        if snap.mode == .trip, let trip = snap.trip {
          TripBadge(trip: trip)
        } else {
          CityLabel(snap: snap, weight: .bold)
        }
        HStack(alignment: .center, spacing: 6) {
          TempHeroView(snap: snap, size: 34)
          WeatherIconView(kind: snap.weatherKind, isDay: snap.isDay, size: 30)
        }
        // Feels-like is dropped here (unlike Large) — the medium left column is
        // narrow, so the meta line stays condition + H/L only.
        if let meta = weatherMetaLine(snap, includeFeelsLike: false), !meta.isEmpty {
          Text(meta)
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(.white.opacity(0.75))
            .lineLimit(1)
            .minimumScaleFactor(0.85)
        }

        Text(headlineText(snap))
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(.white)
          .lineLimit(1)

        // Always show the description (like Large) — it's the core "what to
        // wear" answer and shouldn't depend on there being layering to discuss.
        OutfitDescriptionView(snap: snap, lineLimit: 1)

        Spacer(minLength: 0)

        if snap.mode == .trip, let drift = snap.trip?.driftNote, !drift.isEmpty {
          Text(drift)
            .font(.system(size: 10))
            .foregroundStyle(.white.opacity(0.75))
            .lineLimit(1)
        } else {
          WeatherCuesView(snap: snap, maxAlerts: 2)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      if snap.items.isEmpty {
        Text("No outfit yet")
          .font(.caption)
          .foregroundStyle(.white.opacity(0.75))
      } else {
        // The outfit column: portrait tiles at the original reference ratio,
        // with the min-height floor so sibling content can't squeeze them out.
        OutfitThumbRow(items: snap.items, maxCount: 3, ratio: 0.8, minHeight: 50)
          .frame(maxHeight: .infinity)
      }
    }
    .padding(12)
  }
}

// MARK: - Small

/// One idea per glance: weather glyph + hero temperature up top, the outfit
/// strip in the middle, and a single line — description, else headline — at
/// the bottom. No chips or meta line; the small family cuts detail, not type.
struct SmallOutfitView: View {
  let snap: WidgetSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      if snap.mode == .trip, let trip = snap.trip {
        TripBadge(trip: trip)
      }
      HStack(alignment: .center) {
        WeatherIconView(kind: snap.weatherKind, isDay: snap.isDay, size: 24)
        Spacer(minLength: 4)
        TempHeroView(snap: snap, size: 26)
      }

      OutfitThumbRow(items: snap.items, maxCount: 3, ratio: 0.7, spacing: 4, minHeight: 44)

      Spacer(minLength: 0)

      CompactHintView(snap: snap, maxAlerts: 1)

      Text(headlineText(snap))
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(.white)
        .lineLimit(1)
    }
    .padding(10)
  }
}

// MARK: - Large

/// The systemLarge layout: a full weather header (hero temperature + meta on
/// the left, sunset + signal chips on the right), the outfit headline, big
/// tiles, the 2-line description, cues/drift — and, when the snapshot carries
/// alternate fits, an interactive "Change fit" footer (iOS 17+).
struct LargeOutfitView: View {
  let snap: WidgetSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      if snap.mode == .trip, let trip = snap.trip {
        TripBadge(trip: trip)
      }

      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 2) {
          CityLabel(snap: snap, size: 12, weight: .bold)
          HStack(alignment: .center, spacing: 8) {
            TempHeroView(snap: snap, size: 44)
            WeatherIconView(kind: snap.weatherKind, isDay: snap.isDay, size: 40)
          }
          if let meta = weatherMetaLine(snap), !meta.isEmpty {
            Text(meta)
              .font(.system(size: 12, weight: .medium))
              .foregroundStyle(.white.opacity(0.75))
              .lineLimit(1)
              .minimumScaleFactor(0.85)
          }
        }
        Spacer(minLength: 8)
        VStack(alignment: .trailing, spacing: 5) {
          if let sunset = snap.weather?.sunset {
            HStack(spacing: 3) {
              Image(systemName: "sunset.fill")
                .font(.system(size: 9))
              Text(sunset)
                .font(.system(size: 10, weight: .semibold))
            }
            .foregroundStyle(.white.opacity(0.75))
          }
          SignalChipsView(snap: snap, maxCount: 2)
        }
      }

      Text(headlineText(snap))
        .font(.title3.weight(.semibold))
        .foregroundStyle(.white)
        .lineLimit(1)

      if snap.items.isEmpty {
        Text("No outfit yet")
          .font(.subheadline)
          .foregroundStyle(.white.opacity(0.75))
      } else {
        // Extra horizontal inset beyond the widget padding — without it the
        // end tiles run right up against the widget's edge on device.
        OutfitThumbRow(items: snap.items, maxCount: 4, ratio: 0.8, spacing: 10, maxHeight: 170)
          .padding(.horizontal, 10)
      }

      OutfitDescriptionView(snap: snap, lineLimit: 2)

      // The chips already live in the header; only the (rarer) timeline strip
      // adds anything down here.
      if let timeline = snap.timeline, !timeline.isEmpty {
        TimelineStripView(steps: timeline)
      }

      if snap.mode == .trip, let drift = snap.trip?.driftNote, !drift.isEmpty {
        Text(drift)
          .font(.footnote)
          .foregroundStyle(.white.opacity(0.75))
          .lineLimit(2)
      }

      Spacer(minLength: 0)

      ChangeFitFooter(snap: snap)
    }
    .padding(16)
  }
}

/// "Change fit ›" — an interactive AppIntent button that cycles the snapshot's
/// pre-written outfit variants without opening the app. Only rendered when
/// there's something to cycle to, and only on iOS 17+ (interactive widgets);
/// iOS 16 keeps the whole-widget tap.
struct ChangeFitFooter: View {
  let snap: WidgetSnapshot

  var body: some View {
    if #available(iOS 17.0, *), snap.variantCount > 1 {
      VStack(spacing: 8) {
        Divider().overlay(Color.white.opacity(0.25))
        HStack {
          Spacer()
          Button(intent: ChangeFitIntent()) {
            HStack(spacing: 4) {
              Image(systemName: "arrow.triangle.2.circlepath")
                .font(.system(size: 10, weight: .semibold))
              Text("Change fit")
                .font(.system(size: 12, weight: .semibold))
              Image(systemName: "chevron.right")
                .font(.system(size: 9, weight: .bold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Capsule().fill(Color.white.opacity(0.18)))
          }
          .buttonStyle(.plain)
        }
      }
    }
  }
}

// MARK: - Empty

/// Reason-specific copy + glyph for the empty state, mirroring
/// snapshot.types.ts's WidgetEmptyReason. Shared so Home Screen and Lock Screen
/// empty states can't disagree. Falls back to the generic "add clothes" line for
/// nil (e.g. a pre-data snapshot that predates the emptyReason field).
func emptyStateTitle(_ reason: String?) -> String {
  switch reason {
  case "no_closet":    return "Create a closet to get started"
  case "insufficient": return "Add a top & bottom to build an outfit"
  default:             return "Add clothes to see today's outfit"
  }
}

func emptyStateGlyph(_ reason: String?) -> String {
  switch reason {
  case "no_closet":    return "folder.badge.plus"
  case "insufficient": return "square.stack.3d.up"
  default:             return "tshirt"
  }
}

struct EmptyStateView: View {
  let snap: WidgetSnapshot

  /// On the weather gradient (weather captured) → white text like the outfit
  /// views; on the neutral fallback background → semantic colors.
  private var onGradient: Bool { snap.weatherKind != nil }

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      // Keep the weather backdrop meaningful: hero temperature + glyph, same
      // hierarchy as the outfit views, so the empty state reads as "the same
      // widget, minus the outfit" rather than a different design.
      if onGradient {
        CityLabel(snap: snap)
        HStack(alignment: .center, spacing: 6) {
          TempHeroView(snap: snap, size: 24)
          WeatherIconView(kind: snap.weatherKind, isDay: snap.isDay, size: 24)
          if let cond = snap.weather?.condition, !cond.isEmpty {
            Text(cond)
              .font(.caption)
              .foregroundStyle(.white.opacity(0.75))
              .lineLimit(1)
          }
        }
      }

      Spacer(minLength: 0)

      Image(systemName: emptyStateGlyph(snap.emptyReason))
        .font(.system(size: 20))
        .foregroundStyle(onGradient ? Color.white : Color.ojoAccent)
      Text(emptyStateTitle(snap.emptyReason))
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(onGradient ? .white : .primary)
        .fixedSize(horizontal: false, vertical: true)

      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(12)
  }
}
