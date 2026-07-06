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
  @ViewBuilder
  func tripCountdownBackground() -> some View {
    let gradient = LinearGradient(colors: tripCountdownGradient, startPoint: .top, endPoint: .bottom)
    if #available(iOS 17.0, *) {
      containerBackground(for: .widget) { gradient.overlay(Color.black.opacity(0.16)) }
    } else {
      background(gradient.overlay(Color.black.opacity(0.16)))
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

struct TripCountdownWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: TripCountdownProvider.Entry

  var body: some View {
    Group {
      if let trip = entry.upcoming {
        TripCountdownContent(trip: trip, family: family)
      } else {
        TripCountdownEmptyView()
      }
    }
    .widgetURL(URL(string: deepLink))
    .tripCountdownBackground()
  }

  private var deepLink: String {
    entry.upcoming.map { tripDeepLink($0.planId) } ?? tripLibraryDeepLink
  }
}

private struct TripCountdownContent: View {
  let trip: WidgetSnapshot.UpcomingTrip
  let family: WidgetFamily

  private var dayLabel: String {
    switch trip.daysUntil {
    case 0: return "Today"
    case 1: return "Tomorrow"
    default: return "In \(trip.daysUntil) days"
    }
  }

  var body: some View {
    if family == .systemMedium {
      HStack(alignment: .top, spacing: 14) {
        header
        Spacer(minLength: 0)
        if trip.totalItems > 0 {
          packingBar.frame(width: 120)
        }
      }
      .padding(12)
    } else {
      VStack(alignment: .leading, spacing: 6) {
        header
        Spacer(minLength: 0)
        if trip.totalItems > 0 {
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
