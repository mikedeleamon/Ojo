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
    } else if snapshot.mode == .empty {
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
        EmptyStateView()
      case .today, .trip:
        if family == .systemSmall {
          SmallOutfitView(snap: snap)
        } else {
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

/// One line of layering advice: a compact glyph row for accessory gaps the
/// outfit's item thumbnails don't already show (see widgetAlertsFor in
/// buildInput.ts), or the full recommendation sentence when nothing specific
/// is missing. Never both at once — this view has exactly one line of budget.
struct LayerHintView: View {
  let snap: WidgetSnapshot
  var maxAlerts: Int = 3

  var body: some View {
    if let alerts = snap.alerts, !alerts.isEmpty {
      HStack(spacing: 8) {
        ForEach(Array(alerts.prefix(maxAlerts)), id: \.self) { kind in
          let spec = alertGlyph(kind)
          HStack(spacing: 3) {
            Image(systemName: spec.symbol)
              .font(.system(size: 10, weight: .semibold))
            Text(spec.label)
              .font(.system(size: 10, weight: .semibold))
          }
        }
      }
      .foregroundStyle(.white.opacity(0.9))
    } else if let note = snap.layerNote, !note.isEmpty {
      Text(note)
        .font(.system(size: 10, weight: .medium))
        .foregroundStyle(.white.opacity(0.85))
        .lineLimit(1)
    }
  }
}

// MARK: - Medium

struct MediumOutfitView: View {
  let snap: WidgetSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
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

      LayerHintView(snap: snap)

      if snap.items.isEmpty {
        Text("No outfit yet")
          .font(.caption)
          .foregroundStyle(.white.opacity(0.75))
      } else {
        HStack(spacing: 6) {
          ForEach(Array(snap.items.prefix(4))) { item in
            ThumbView(item: item)
              .aspectRatio(0.8, contentMode: .fit)
          }
        }
      }

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

      HStack(spacing: 4) {
        ForEach(Array(snap.items.prefix(3))) { item in
          ThumbView(item: item)
            .aspectRatio(0.7, contentMode: .fit)
        }
      }

      LayerHintView(snap: snap, maxAlerts: 1)

      Spacer(minLength: 0)

      Text(headlineText(snap))
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(.white)
        .lineLimit(1)
    }
    .padding(10)
  }
}

// MARK: - Empty

struct EmptyStateView: View {
  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: "eye")
        .font(.system(size: 22))
        .foregroundStyle(Color.ojoAccent)
      Text("Add clothes to see today's outfit")
        .font(.caption)
        .multilineTextAlignment(.center)
        .foregroundStyle(.secondary)
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}
