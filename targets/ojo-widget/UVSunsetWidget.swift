import SwiftUI
import WidgetKit

/// UV + Sunset: a Lock Screen pair for the two sun signals the snapshot
/// already carries — the UV category (WeatherBlock.uvText, always present
/// when weather is) and today's sunset time. Shares OjoProvider: same
/// snapshot, same refresh cadence as the main widget.
struct OjoUVSunsetWidget: Widget {
  let kind = "OjoUVSunset"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: OjoProvider()) { entry in
      UVSunsetWidgetView(entry: entry)
    }
    .configurationDisplayName("UV & Sunset")
    .description("Today's UV level and sunset time at a glance.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

// MARK: - UV category mapping

/// WeatherKit's five UV categories mapped onto a 0–1 gauge. The snapshot only
/// carries the category text (no numeric index), so the gauge shows the band,
/// not a precise reading — which is also all a glance needs.
private func uvFraction(_ text: String) -> Double {
  switch text {
  case "Low":       return 0.2
  case "Moderate":  return 0.4
  case "High":      return 0.6
  case "Very High": return 0.8
  case "Extreme":   return 1.0
  default:          return 0.0
  }
}

/// Circular-gauge center label — "Very High" can't fit in a 45pt circle.
private func uvShortLabel(_ text: String) -> String {
  switch text {
  case "Moderate":  return "Mod"
  case "Very High": return "V.High"
  default:          return text
  }
}

// MARK: - Root

struct UVSunsetWidgetView: View {
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
      UVCircularView(snap: snap)
    case .accessoryInline:
      UVInlineView(snap: snap)
    default:
      UVRectangularView(snap: snap)
    }
  }
}

// MARK: - Circular

/// UV band as a gauge arc with the category in the center. Falls back to a
/// plain sun glyph when the snapshot has no weather yet (pre-first-launch).
struct UVCircularView: View {
  let snap: WidgetSnapshot

  var body: some View {
    if let uv = snap.weather?.uvText, !uv.isEmpty {
      Gauge(value: uvFraction(uv)) {
        Text("UV")
      } currentValueLabel: {
        Text(uvShortLabel(uv))
          .font(.system(size: 11, weight: .semibold))
          .minimumScaleFactor(0.6)
      }
      .gaugeStyle(.accessoryCircular)
      .widgetAccentable()
    } else {
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 1) {
          Image(systemName: "sun.max.fill")
            .font(.system(size: 16, weight: .semibold))
            .widgetAccentable()
          Text("UV")
            .font(.system(size: 10, weight: .semibold))
        }
      }
    }
  }
}

// MARK: - Rectangular

/// Two stacked signal lines: UV category on top, sunset under it. Either line
/// drops out when its data is missing; both missing shows the setup nudge.
struct UVRectangularView: View {
  let snap: WidgetSnapshot

  var body: some View {
    let uv = snap.weather?.uvText
    let sunset = snap.weather?.sunset
    if uv == nil && sunset == nil {
      HStack(spacing: 6) {
        Image(systemName: "sun.max.fill")
          .font(.system(size: 16))
          .widgetAccentable()
        Text("Open Ojo for UV & sunset")
          .font(.system(size: 12, weight: .medium))
          .lineLimit(2)
      }
    } else {
      VStack(alignment: .leading, spacing: 2) {
        if let uv = uv, !uv.isEmpty {
          HStack(spacing: 5) {
            Image(systemName: "sun.max.fill")
              .font(.system(size: 12, weight: .semibold))
              .widgetAccentable()
            Text("UV \(uv)")
              .font(.system(size: 13, weight: .semibold))
              .lineLimit(1)
          }
        }
        if let sunset = sunset, !sunset.isEmpty {
          HStack(spacing: 5) {
            Image(systemName: "sunset.fill")
              .font(.system(size: 12, weight: .semibold))
            Text("Sunset \(sunset)")
              .font(.system(size: 13, weight: .semibold))
              .lineLimit(1)
          }
        }
      }
    }
  }
}

// MARK: - Inline

/// One line above the clock: "UV High · Sunset 8:14 PM", dropping whichever
/// half is missing.
struct UVInlineView: View {
  let snap: WidgetSnapshot

  private var text: String {
    var parts: [String] = []
    if let uv = snap.weather?.uvText, !uv.isEmpty { parts.append("UV \(uv)") }
    if let sunset = snap.weather?.sunset, !sunset.isEmpty { parts.append("Sunset \(sunset)") }
    return parts.isEmpty ? "Open Ojo for UV & sunset" : parts.joined(separator: " · ")
  }

  var body: some View {
    Label(text, systemImage: "sun.max.fill")
  }
}
