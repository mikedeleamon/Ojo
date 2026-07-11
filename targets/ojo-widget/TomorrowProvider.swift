import WidgetKit
import Foundation

/// Local hour at which the Tomorrow Prep widget flips from today's fit to
/// tomorrow's — the "lay out your clothes" evening moment.
let tomorrowFlipHour = 18

struct TomorrowEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot
  /// True once the evening flip has happened — the view shows the tomorrow
  /// block (when it's present and still describes calendar-tomorrow).
  let showTomorrow: Bool
}

/// Same snapshot source as the main widget, but the timeline carries the 6 PM
/// flip as its own entry so the today→tomorrow switch happens on schedule even
/// if the app never runs that evening.
struct TomorrowProvider: TimelineProvider {
  func placeholder(in context: Context) -> TomorrowEntry {
    TomorrowEntry(date: Date(), snapshot: .placeholder, showTomorrow: true)
  }

  func getSnapshot(in context: Context, completion: @escaping (TomorrowEntry) -> Void) {
    // Gallery preview shows the tomorrow phase — it's the widget's point.
    if context.isPreview {
      completion(TomorrowEntry(date: Date(), snapshot: .placeholder, showTomorrow: true))
      return
    }
    let snap = SnapshotStore.load() ?? .empty
    completion(TomorrowEntry(date: Date(), snapshot: snap, showTomorrow: isPastFlip(Date())))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TomorrowEntry>) -> Void) {
    let snap = SnapshotStore.load() ?? .empty
    let now = Date()
    var entries = [TomorrowEntry(date: now, snapshot: snap, showTomorrow: isPastFlip(now))]

    // The flip is a scheduled entry, not a reload: WidgetKit swaps to it at
    // exactly 6 PM with no refresh-budget cost.
    if let flip = todayFlipDate(), flip > now {
      entries.append(TomorrowEntry(date: flip, snapshot: snap, showTomorrow: true))
    }

    // Fallback refresh mirrors the main widget: the app pushes real updates via
    // reloadAllTimelines; this only covers "app hasn't run" — at midnight the
    // stale tomorrow block stops validating and the view falls back to today.
    let hourly = now.addingTimeInterval(3600)
    let refreshAt = min(nextMidnight() ?? hourly, hourly)
    completion(Timeline(entries: entries, policy: .after(refreshAt)))
  }
}

private func todayFlipDate() -> Date? {
  Calendar.current.date(bySettingHour: tomorrowFlipHour, minute: 0, second: 0, of: Date())
}

private func isPastFlip(_ date: Date) -> Bool {
  Calendar.current.component(.hour, from: date) >= tomorrowFlipHour
}
