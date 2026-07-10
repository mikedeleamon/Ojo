import SwiftUI
import WidgetKit

/// A fixed, on-brand gradient rather than the weather gradient used by the main
/// widget — this surface is about an upcoming trip, not today's conditions, so
/// tying its color to current weather would send the wrong signal. Matches the
/// brand green ramp used in the Ojo logo (src/components/icons/OjoLogoIcon.tsx).
private let tripCountdownGradient: [Color] = [
  Color(red: 0x4F / 255, green: 0xEE / 255, blue: 0xC3 / 255), // #4feec3
  Color.ojoAccent,                                             // #87DE5A
  Color(red: 0x65 / 255, green: 0xBA / 255, blue: 0x02 / 255), // #65ba02
  Color(red: 0x56 / 255, green: 0xB1 / 255, blue: 0x07 / 255), // #56b107
]

extension View {
  /// Home Screen families get the brand gradient; Lock Screen accessory families
  /// get a CLEAR container background so the system's own vibrancy/tint shows.
  ///
  /// iOS 17 requires EVERY family — accessory included — to declare a
  /// `containerBackground`; a family that renders without one shows WidgetKit's
  /// "Please adopt the containerBackground API" error placeholder instead of the
  /// content (which is exactly what the accessory families did before). Mirrors
  /// OjoWidgetViews.swift's `ojoWidgetBackground`.
  @ViewBuilder
  func tripCountdownBackground(family: WidgetFamily) -> some View {
    if family == .accessoryCircular || family == .accessoryRectangular || family == .accessoryInline {
      if #available(iOS 17.0, *) {
        containerBackground(for: .widget) { Color.clear }
      } else {
        self
      }
    } else {
      let gradient = LinearGradient(colors: tripCountdownGradient, startPoint: .top, endPoint: .bottom)
      if #available(iOS 17.0, *) {
        containerBackground(for: .widget) { gradient.overlay(Color.black.opacity(0.16)) }
      } else {
        background(gradient.overlay(Color.black.opacity(0.16)))
      }
    }
  }
}

/// Deep-link strings here MUST match src/lib/widget/deepLinks.ts — Swift can't
/// import the TS constants, so this is the one place they're duplicated.
private func tripDeepLink(_ planId: String) -> String {
  let encoded = planId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? planId
  return "ojo://trip/\(encoded)"
}
private let tripLibraryDeepLink = "ojo://trips"

/// "Today" / "Tomorrow" / "In N days" — shared so the Home Screen content and
/// both Lock Screen families phrase the countdown identically.
func tripDayLabel(_ daysUntil: Int) -> String {
  switch daysUntil {
  case 0: return "Today"
  case 1: return "Tomorrow"
  default: return "In \(daysUntil) days"
  }
}

struct TripCountdownWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: TripCountdownProvider.Entry

  var body: some View {
    // Every family routes through the same background modifier so each one
    // declares a containerBackground (iOS 17 requires it — see below). Lock
    // Screen families are composited with system vibrancy, so theirs is clear.
    content
      .widgetURL(URL(string: deepLink))
      .tripCountdownBackground(family: family)
  }

  @ViewBuilder private var content: some View {
    switch family {
    case .accessoryCircular:
      TripCountdownCircularView(trip: entry.upcoming)
    case .accessoryRectangular:
      TripCountdownRectangularView(trip: entry.upcoming)
    default:
      if let trip = entry.upcoming {
        TripCountdownContent(trip: trip, family: family)
      } else {
        TripCountdownEmptyView()
      }
    }
  }

  private var deepLink: String {
    entry.upcoming.map { tripDeepLink($0.planId) } ?? tripLibraryDeepLink
  }
}

private struct TripCountdownContent: View {
  let trip: WidgetSnapshot.UpcomingTrip
  let family: WidgetFamily

  private var dayLabel: String { tripDayLabel(trip.daysUntil) }

  var body: some View {
    if family == .systemMedium {
      HStack(alignment: .top, spacing: 14) {
        VStack(alignment: .leading, spacing: 6) {
          header
          driftChip
        }
        Spacer(minLength: 0)
        if trip.totalItems > 0 {
          packingBar.frame(width: 120)
        }
      }
      .padding(12)
    } else {
      // systemSmall: keep the weather peek visible, and let the actionable
      // drift note take the bottom slot when present (else packing progress).
      VStack(alignment: .leading, spacing: 6) {
        header
        Spacer(minLength: 0)
        if trip.driftNote?.isEmpty == false {
          driftChip
        } else if trip.totalItems > 0 {
          packingBar
        }
      }
      .padding(12)
    }
  }

  private var header: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack(spacing: 4) {
        Image(systemName: "airplane.departure")
          .font(.system(size: 11))
        Text(dayLabel)
          .font(.system(size: 13, weight: .semibold))
      }
      .foregroundStyle(.white)

      Text(trip.destination)
        .font(.headline)
        .foregroundStyle(.white)
        .lineLimit(1)

      weatherLine
    }
  }

  /// Arrival-day forecast peek: condition glyph + H/L, with a rain hint. Nothing
  /// renders for pending trips whose saved plan has no forecast yet.
  @ViewBuilder private var weatherLine: some View {
    if let w = trip.weather {
      HStack(spacing: 5) {
        Image(systemName: WeatherGradient.sfSymbolName(kind: w.weatherKind, isDay: true))
          .font(.system(size: 11))
        Text("H:\(w.high)° L:\(w.low)°")
          .font(.system(size: 12, weight: .medium))
        if w.precip {
          Image(systemName: "umbrella.fill").font(.system(size: 10))
        }
      }
      .foregroundStyle(.white.opacity(0.9))
    }
  }

  /// Forecast-drift alert. Frosted capsule matching the main widget's signal
  /// chips; only present when the fresh forecast diverged from the saved plan.
  @ViewBuilder private var driftChip: some View {
    if let note = trip.driftNote, !note.isEmpty {
      HStack(alignment: .top, spacing: 4) {
        Image(systemName: "exclamationmark.triangle.fill")
          .font(.system(size: 9))
        Text(note)
          .font(.system(size: 10, weight: .medium))
          .lineLimit(family == .systemMedium ? 2 : 3)
      }
      .padding(.horizontal, 8)
      .padding(.vertical, 4)
      .background(Capsule().fill(Color.white.opacity(0.18)))
      .foregroundStyle(.white)
    }
  }

  private var packingBar: some View {
    VStack(alignment: .leading, spacing: 4) {
      GeometryReader { geo in
        let fraction = trip.totalItems > 0
          ? min(1, max(0, Double(trip.packedItems) / Double(trip.totalItems)))
          : 0
        ZStack(alignment: .leading) {
          Capsule().fill(Color.white.opacity(0.18))
          Capsule().fill(Color.ojoAccent).frame(width: geo.size.width * fraction)
        }
      }
      .frame(height: 5)
      Text("\(trip.packedItems)/\(trip.totalItems) packed")
        .font(.system(size: 10))
        .foregroundStyle(.white.opacity(0.75))
    }
  }
}

private struct TripCountdownEmptyView: View {
  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: "airplane")
        .font(.system(size: 22))
        .foregroundStyle(.white)
      Text("Plan a trip to see your countdown")
        .font(.caption)
        .multilineTextAlignment(.center)
        .foregroundStyle(.white.opacity(0.75))
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

// MARK: - Lock Screen

/// `.accessoryCircular`: a ring of packing progress with the day count in the
/// center. Falls back to an icon + day count when there's nothing to pack yet
/// (a pending trip), or the empty-trip glyph when no trip is planned.
private struct TripCountdownCircularView: View {
  let trip: WidgetSnapshot.UpcomingTrip?

  var body: some View {
    if let trip = trip {
      if trip.totalItems > 0 {
        Gauge(value: Double(min(trip.packedItems, trip.totalItems)), in: 0...Double(trip.totalItems)) {
          Image(systemName: "airplane.departure")
        } currentValueLabel: {
          Text("\(trip.daysUntil)")
            .font(.system(size: 16, weight: .semibold, design: .rounded))
            .monospacedDigit()
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .widgetAccentable()
      } else {
        ZStack {
          AccessoryWidgetBackground()
          VStack(spacing: 0) {
            Image(systemName: "airplane.departure")
              .font(.system(size: 12, weight: .semibold))
              .widgetAccentable()
            Text("\(trip.daysUntil)d")
              .font(.system(size: 15, weight: .semibold, design: .rounded))
              .monospacedDigit()
          }
        }
      }
    } else {
      ZStack {
        AccessoryWidgetBackground()
        Image(systemName: "airplane")
          .font(.system(size: 18, weight: .semibold))
          .widgetAccentable()
      }
    }
  }
}

/// `.accessoryRectangular`: the countdown up top, then the arrival-day forecast
/// — or the drift note when the forecast has shifted, since that's the more
/// actionable line. Falls back to a "plan a trip" prompt when nothing's planned.
private struct TripCountdownRectangularView: View {
  let trip: WidgetSnapshot.UpcomingTrip?

  var body: some View {
    if let trip = trip {
      HStack(alignment: .center, spacing: 6) {
        Image(systemName: "airplane.departure")
          .font(.system(size: 16))
          .widgetAccentable()
        VStack(alignment: .leading, spacing: 1) {
          Text("\(trip.destination) · \(tripDayLabel(trip.daysUntil))")
            .font(.system(size: 13, weight: .semibold))
            .lineLimit(1)
          Text(secondLine(trip))
            .font(.system(size: 11))
            .lineLimit(1)
        }
      }
    } else {
      Label("Plan a trip to see your countdown", systemImage: "airplane")
        .font(.system(size: 12))
    }
  }

  /// Drift wins (actionable) → else the forecast peek → else packing progress.
  private func secondLine(_ trip: WidgetSnapshot.UpcomingTrip) -> String {
    if let note = trip.driftNote, !note.isEmpty { return note }
    if let w = trip.weather {
      let peek = "H:\(w.high)° L:\(w.low)°"
      return w.precip ? "\(peek) · rain" : peek
    }
    if trip.totalItems > 0 { return "\(trip.packedItems)/\(trip.totalItems) packed" }
    return "Tap to plan your looks"
  }
}
