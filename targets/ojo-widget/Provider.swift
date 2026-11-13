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
    let now = Date()
    let snap = context.isPreview ? .placeholder : current(resolvedSnapshot(), at: now)
    completion(OjoEntry(date: now, snapshot: snap))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<OjoEntry>) -> Void) {
    let now = Date()
    let snap = SnapshotStore.load().map(applyingChosenVariant) ?? .empty
    var entries = [OjoEntry(date: now, snapshot: current(snap, at: now))]

    // The snapshot describes the day it was written. Without this entry the
    // widget kept presenting yesterday's weather and outfit as today's until
    // the app next ran. A scheduled entry flips it at midnight exactly, with
    // no refresh-budget cost, even if WidgetKit delays the reload below.
    if let midnight = nextMidnight(), !snap.isStale(at: now) {
      entries.append(OjoEntry(date: midnight, snapshot: snap.staleVersion))
    }

    // The app pushes updates via WidgetCenter.reloadAllTimelines() — from the
    // foreground and from its background refresh (src/lib/background). This
    // policy is only a fallback re-read: at the next local midnight (trip
    // day-index rollover) or within the hour, whichever comes first.
    let hourly = now.addingTimeInterval(3600)
    let refreshAt = min(nextMidnight() ?? hourly, hourly)
    completion(Timeline(entries: entries, policy: .after(refreshAt)))
  }

  /// The snapshot as of `date`: itself while it describes today, else its
  /// stale fallback.
  private func current(_ snap: WidgetSnapshot, at date: Date) -> WidgetSnapshot {
    snap.isStale(at: date) ? snap.staleVersion : snap
  }
}

/// Shared by every provider whose data rolls over at the local day boundary
/// (main widget, Tomorrow Prep, Layer Timeline).
func nextMidnight() -> Date? {
  Calendar.current.nextDate(
    after: Date(),
    matching: DateComponents(hour: 0, minute: 0),
    matchingPolicy: .nextTime
  )
}

/// The snapshot with the user's "Change fit" choice applied — index 0 unless
/// they cycled fits since this exact snapshot was written (see VariantIndexStore).
private func applyingChosenVariant(_ snap: WidgetSnapshot) -> WidgetSnapshot {
  snap.applyingVariant(VariantIndexStore.currentIndex(for: snap))
}

private func resolvedSnapshot() -> WidgetSnapshot {
  SnapshotStore.load().map(applyingChosenVariant) ?? .placeholder
}
