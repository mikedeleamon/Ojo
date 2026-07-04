import WidgetKit

struct OjoEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot
}

struct OjoProvider: TimelineProvider {
  func placeholder(in context: Context) -> OjoEntry {
    OjoEntry(date: Date(), snapshot: .placeholder)
  }

  func getSnapshot(in context: Context, completion: @escaping (OjoEntry) -> Void) {
    // Show the sample in the gallery preview; real data on the home screen.
    let snap = context.isPreview ? .placeholder : (SnapshotStore.load() ?? .placeholder)
    completion(OjoEntry(date: Date(), snapshot: snap))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<OjoEntry>) -> Void) {
    let snap = SnapshotStore.load() ?? .empty
    let entry = OjoEntry(date: Date(), snapshot: snap)

    // The app pushes updates immediately via WidgetCenter.reloadAllTimelines().
    // This policy is only a fallback so the widget still refreshes if the app
    // hasn't run: at the next local midnight (trip day-index rollover) or within
    // the hour, whichever comes first.
    let hourly = Date().addingTimeInterval(3600)
    let refreshAt = min(nextMidnight() ?? hourly, hourly)
    completion(Timeline(entries: [entry], policy: .after(refreshAt)))
  }
}

private func nextMidnight() -> Date? {
  Calendar.current.nextDate(
    after: Date(),
    matching: DateComponents(hour: 0, minute: 0),
    matchingPolicy: .nextTime
  )
}
