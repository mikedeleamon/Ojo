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
    if family == .accessoryRectangular || family == .accessoryInline {
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

// MARK: - Layer hint (weather-driven accessory nudge)

private struct AlertGlyphSpec {
  let symbol: String
  let label: String
}

private func alertGlyph(_ kind: String) -> AlertGlyphSpec {
  switch kind {
  case "rain":  return AlertGlyphSpec(symbol: "umbrella.fill", label: "Rain")
  case "layer": return AlertGlyphSpec(symbol: "tshirt.fill", label: "Layer up")
  case "snow":  return AlertGlyphSpec(symbol: "snowflake", label: "Boots")
  case "uv":    return AlertGlyphSpec(symbol: "sun.max.fill", label: "UV")
  default:      return AlertGlyphSpec(symbol: "exclamationmark.circle", label: kind)
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
/// more specific — see TimelineStripView) or a compact accessory-gap glyph row
/// (see widgetAlertsFor in buildInput.ts). Shown only when the day has
/// something time-sensitive or a gap the item thumbnails don't already cover;
/// most days this renders nothing.
struct WeatherCuesView: View {
  let snap: WidgetSnapshot
  var maxAlerts: Int = 3
  var showTimeline: Bool = true

  var body: some View {
    if showTimeline, let timeline = snap.timeline, !timeline.isEmpty {
      TimelineStripView(steps: timeline)
    } else if let alerts = snap.alerts, !alerts.isEmpty {
      HStack(spacing: 8) {
        ForEach(Array(alerts.prefix(maxAlerts)), id: \.self) { kind in
          let spec = alertGlyph(kind)
          HStack(spacing: 3) {
            Image(systemName: spec.symbol)
              .font(.system(size: 10, weight: .semibold))
            Text(alertLabel(kind, spec: spec, snap: snap))
              .font(.system(size: 10, weight: .semibold))
          }
        }
      }
      .foregroundStyle(.white.opacity(0.9))
    }
  }
}

/// The chip's text. Most alerts use their static label; "uv" appends the
/// numeric index when known ("UV 8") so it's an actual reading, not just "UV".
private func alertLabel(_ kind: String, spec: AlertGlyphSpec, snap: WidgetSnapshot) -> String {
  if kind == "uv", let uv = snap.uvIndex {
    return "UV \(uv)"
  }
  return spec.label
}

// MARK: - Timeline strip (same-day layer changes)

/// Maps a timeline step's `action` text to an icon by matching layeringEngine's
/// small, fixed set of template prefixes (see buildTimeline in layeringEngine.ts)
/// — keying off known app-authored copy, not open-ended text parsing.
private func timelineActionIcon(_ action: String) -> String {
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
/// during the day, which a single static line can't convey. Home Screen
/// Medium only (see LayerHintView's showTimeline) — Small has no room left
/// once headline/temp/items are laid out.
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

/// A row of garment thumbnails at a FIXED height. The fixed height matters: in a
/// tight VStack, a flexible `.aspectRatio(.fit)` thumbnail collapses toward zero
/// when vertical space runs out (which hid the clothes on the medium widget) —
/// pinning the height guarantees the items always render, and only lower-priority
/// content below gets clipped instead.
struct OutfitThumbRow: View {
  let items: [WidgetSnapshot.Item]
  var maxCount: Int
  var height: CGFloat
  var spacing: CGFloat = 6

  var body: some View {
    HStack(spacing: spacing) {
      ForEach(Array(items.prefix(maxCount))) { item in
        ThumbView(item: item)
          .frame(maxWidth: .infinity)
          .frame(height: height)
      }
    }
  }
}

// MARK: - Medium

struct MediumOutfitView: View {
  let snap: WidgetSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      VStack(alignment: .leading, spacing: 2) {
        if snap.mode == .trip, let trip = snap.trip {
          TripBadge(trip: trip)
        }
        HStack(spacing: 6) {
          WeatherIconView(kind: snap.weatherKind, isDay: snap.isDay, size: 18)
          Text(headlineText(snap))
            .font(.headline)
            .foregroundStyle(.white)
            .lineLimit(1)
        }
        if let temp = snap.tempLine, !temp.isEmpty {
          Text(temp)
            .font(.caption)
            .foregroundStyle(.white.opacity(0.75))
            .lineLimit(1)
        }
      }

      // 1 line on medium to leave room for the thumbnails below.
      OutfitDescriptionView(snap: snap, lineLimit: 1)

      if snap.items.isEmpty {
        Text("No outfit yet")
          .font(.caption)
          .foregroundStyle(.white.opacity(0.75))
      } else {
        OutfitThumbRow(items: snap.items, maxCount: 4, height: 56)
      }

      WeatherCuesView(snap: snap)

      if snap.mode == .trip, let drift = snap.trip?.driftNote, !drift.isEmpty {
        Text(drift)
          .font(.system(size: 10))
          .foregroundStyle(.white.opacity(0.75))
          .lineLimit(2)
      }

      Spacer(minLength: 0)
    }
    .padding(12)
  }
}

// MARK: - Small

struct SmallOutfitView: View {
  let snap: WidgetSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 4) {
        WeatherIconView(kind: snap.weatherKind, isDay: snap.isDay, size: 14)
        if snap.mode == .trip, let trip = snap.trip {
          TripBadge(trip: trip)
        } else if let temp = snap.tempLine, !temp.isEmpty {
          Text(temp)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(.white.opacity(0.75))
            .lineLimit(1)
        }
      }

      OutfitThumbRow(items: snap.items, maxCount: 3, height: 58, spacing: 4)

      Spacer(minLength: 0)

      // The outfit description is the small widget's payoff line; fall back to
      // the weather headline only when there's no description (e.g. empty state).
      if let note = snap.layerNote, !note.isEmpty {
        Text(note)
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(.white.opacity(0.9))
          .lineLimit(2)
          .fixedSize(horizontal: false, vertical: true)
      } else {
        Text(headlineText(snap))
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(.white)
          .lineLimit(1)
      }
    }
    .padding(10)
  }
}

// MARK: - Large

/// The systemLarge layout: the same content as Medium but with room to breathe —
/// bigger thumbnails, a full 2-line description, and both the weather cues and
/// (space permitting) the trip drift note, none of which have to fight for space.
struct LargeOutfitView: View {
  let snap: WidgetSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      VStack(alignment: .leading, spacing: 3) {
        if snap.mode == .trip, let trip = snap.trip {
          TripBadge(trip: trip)
        }
        HStack(spacing: 8) {
          WeatherIconView(kind: snap.weatherKind, isDay: snap.isDay, size: 28)
          Text(headlineText(snap))
            .font(.title3.weight(.semibold))
            .foregroundStyle(.white)
            .lineLimit(1)
        }
        if let temp = snap.tempLine, !temp.isEmpty {
          Text(temp)
            .font(.subheadline)
            .foregroundStyle(.white.opacity(0.75))
            .lineLimit(1)
        }
      }

      OutfitDescriptionView(snap: snap, lineLimit: 2)

      if snap.items.isEmpty {
        Text("No outfit yet")
          .font(.subheadline)
          .foregroundStyle(.white.opacity(0.75))
      } else {
        OutfitThumbRow(items: snap.items, maxCount: 4, height: 150, spacing: 10)
      }

      WeatherCuesView(snap: snap)

      if snap.mode == .trip, let drift = snap.trip?.driftNote, !drift.isEmpty {
        Text(drift)
          .font(.footnote)
          .foregroundStyle(.white.opacity(0.75))
          .lineLimit(2)
      }

      Spacer(minLength: 0)
    }
    .padding(16)
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
      // Keep the weather backdrop meaningful: show the icon + temp when present.
      if onGradient {
        HStack(spacing: 6) {
          WeatherIconView(kind: snap.weatherKind, isDay: snap.isDay, size: 18)
          if let temp = snap.tempLine, !temp.isEmpty {
            Text(temp)
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
