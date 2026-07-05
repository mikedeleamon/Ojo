import SwiftUI
import WidgetKit

/// Shared content for both Lock Screen accessory families — computed once per
/// snapshot so accessoryRectangular and accessoryInline can't disagree about
/// icon/text for the same data. No hardcoded colors here: Lock Screen widgets
/// are composited by the system with its own vibrancy/tint, so text uses the
/// default style rather than the white-on-gradient treatment the Home Screen
/// widget needs (see OjoWidgetViews.swift's ojoWidgetBackground).
private struct LockScreenContent {
  let icon: String
  /// accessoryRectangular's larger line; also what accessoryInline shows for
  /// trip/empty modes, where the day/destination or empty prompt IS the point.
  let line1: String
  /// accessoryRectangular's smaller second line — nil when there's nothing to add.
  let line2: String?
  /// The single string accessoryInline shows. Prefers temp over headline for
  /// 'today' (more glanceable at a lock-screen glance); prefers line1 for
  /// trip/empty, where day/destination matters more than the drift note.
  let inlineText: String

  init(_ snap: WidgetSnapshot) {
    switch snap.mode {
    case .trip:
      let trip = snap.trip
      icon = (trip?.locationConfirmed == true) ? "location.fill" : "airplane"
      line1 = trip.map { "Day \($0.dayIndex)/\($0.dayTotal) · \($0.destination)" } ?? "Trip"
      line2 = trip?.driftNote
      inlineText = line1
    case .today:
      icon = WeatherGradient.sfSymbolName(kind: snap.weatherKind, isDay: snap.isDay)
      line1 = snap.headline.isEmpty ? "Today's Outfit" : snap.headline
      line2 = snap.tempLine
      inlineText = snap.tempLine ?? line1
    case .empty:
      icon = "eye"
      line1 = "No outfit yet"
      line2 = "Add clothes to start"
      inlineText = line1
    }
  }
}

struct LockScreenRectangularView: View {
  let snap: WidgetSnapshot

  var body: some View {
    let c = LockScreenContent(snap)
    HStack(alignment: .center, spacing: 6) {
      Image(systemName: c.icon)
        .font(.system(size: 16))
        .widgetAccentable()
      VStack(alignment: .leading, spacing: 1) {
        Text(c.line1)
          .font(.system(size: 13, weight: .semibold))
          .lineLimit(1)
        if let line2 = c.line2, !line2.isEmpty {
          Text(line2)
            .font(.system(size: 11))
            .lineLimit(1)
        }
      }
    }
  }
}

struct LockScreenInlineView: View {
  let snap: WidgetSnapshot

  var body: some View {
    let c = LockScreenContent(snap)
    Label(c.inlineText, systemImage: c.icon)
  }
}
