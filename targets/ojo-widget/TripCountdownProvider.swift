import WidgetKit

struct TripCountdownEntry: TimelineEntry {
  let date: Date
  let upcoming: WidgetSnapshot.UpcomingTrip?
}

/// Reads the SAME snapshot.json as OjoProvider (SnapshotStore is shared), but
/// only cares about `upcomingTrip` — a distinct, complementary surface: the
/// main widget covers "today / during a trip," this one covers "a trip is
/// coming up." Purely date-driven, so a once-daily fallback refresh is enough;
/// real updates arrive instantly via WidgetCenter.reloadAllTimelines() from the
/// same bridge call that updates the main widget.
struct TripCountdownProvider: TimelineProvider {
  func placeholder(in context: Context) -> TripCountdownEntry {
    TripCountdownEntry(
      date: Date(),
      upcoming: WidgetSnapshot.UpcomingTrip(
        planId: "preview", destination: "Lisbon", daysUntil: 6, totalItems: 12, packedItems: 4
      )
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (TripCountdownEntry) -> Void) {
    if context.isPreview {
      completion(placeholder(in: context))
      return
    }
    completion(TripCountdownEntry(date: Date(), upcoming: SnapshotStore.load()?.upcomingTrip))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TripCountdownEntry>) -> Void) {
    let entry = TripCountdownEntry(date: Date(), upcoming: SnapshotStore.load()?.upcomingTrip)
    let refreshAt = nextMidnight() ?? Date().addingTimeInterval(86_400)
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
