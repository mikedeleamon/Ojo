import Foundation

/// Mirrors src/lib/widget/snapshot.types.ts (`OjoWidgetSnapshot`). Decoded 1:1
/// from snapshot.json in the shared App Group container. Keep field names in
/// sync with the TypeScript contract and the native bridge module.
struct WidgetSnapshot: Codable {
  enum Mode: String, Codable { case today, trip, empty }

  let mode: Mode
  let updatedAt: String
  let headline: String
  let tempLine: String?
  /// Mirrors lib/weather/conditions.ts WeatherKind. Optional (rather than
  /// required) so a snapshot written before this field existed still decodes —
  /// WeatherGradient.swift falls back to a neutral gradient when nil.
  let weatherKind: String?
  let isDay: Bool?
  let items: [Item]
  /// Short layering call-to-action from the JS layering engine, e.g. "Bring a
  /// jacket — windy after 4pm." Optional so older snapshots still decode.
  let layerNote: String?
  /// Accessory gaps not already visible from `items`' thumbnails, priority
  /// order: "rain" | "layer" | "snow" | "uv". Optional (not just empty) so a
  /// snapshot written before this field existed still decodes.
  let alerts: [String]?
  /// UV category text ("High"/"Very High"/"Extreme") for the "uv" alert's
  /// label — matches the app's WeatherDetails "UV Index" stat. Nil when
  /// unknown → label stays plain "UV".
  let uvIndexText: String?
  /// Same-day layer-change steps (layeringEngine's buildTimeline), capped to a
  /// few by the JS side. Only present on days with a real temp swing or a
  /// precip start/stop — most days this is nil, not just empty.
  let timeline: [TimelineStep]?
  /// Present only when mode == .empty: "no_closet" | "empty_closet" |
  /// "insufficient" — which setup step the user is missing. Optional so older
  /// snapshots still decode.
  let emptyReason: String?
  let trip: TripInfo?
  /// The soonest saved trip that hasn't started yet — independent of `mode`;
  /// powers the separate Trip Countdown widget.
  let upcomingTrip: UpcomingTrip?
  let deepLink: String

  struct Item: Codable, Identifiable {
    let id: String
    let role: String
    /// Container-relative thumbnail path ("thumbs/<hash>.jpg"), or nil when uncached.
    let thumb: String?
  }

  struct TripInfo: Codable {
    let destination: String
    let dayIndex: Int
    let dayTotal: Int
    let driftNote: String?
    let locationConfirmed: Bool
  }

  struct UpcomingTrip: Codable {
    let planId: String
    let destination: String
    let daysUntil: Int
    let totalItems: Int
    let packedItems: Int
  }

  /// `time` is one of layeringEngine's 7 buckets (Early morning/Morning/Late
  /// morning/Early afternoon/Afternoon/Evening/Night); `action` is free text
  /// from a small fixed set of templates — see TimelineStripView's icon match.
  struct TimelineStep: Codable, Identifiable {
    let time: String
    let action: String
    var id: String { "\(time)|\(action)" }
  }
}

extension WidgetSnapshot {
  /// Gallery / pre-data sample shown before the app writes a real snapshot.
  static let placeholder = WidgetSnapshot(
    mode: .today,
    updatedAt: "",
    headline: "Today's Outfit",
    tempLine: "72° · Clear",
    weatherKind: "clear",
    isDay: true,
    items: [
      Item(id: "1", role: "top", thumb: nil),
      Item(id: "2", role: "bottom", thumb: nil),
      Item(id: "3", role: "footwear", thumb: nil),
    ],
    layerNote: "Layer up — cooler after sunset.",
    alerts: ["layer"],
    uvIndexText: "High",
    timeline: [
      TimelineStep(time: "Afternoon", action: "Remove your jacket — warming up"),
      TimelineStep(time: "Evening", action: "Add it back — sun is setting, cooling down"),
    ],
    emptyReason: nil,
    trip: nil,
    upcomingTrip: nil,
    deepLink: "ojo://outfit"
  )

  /// Fallback when no snapshot has been written yet (or it failed to decode).
  static let empty = WidgetSnapshot(
    mode: .empty,
    updatedAt: "",
    headline: "",
    tempLine: nil,
    weatherKind: nil,
    isDay: nil,
    items: [],
    layerNote: nil,
    alerts: [],
    uvIndexText: nil,
    timeline: nil,
    emptyReason: nil,
    trip: nil,
    upcomingTrip: nil,
    deepLink: "ojo://outfit"
  )
}

/// Reads the snapshot and resolves thumbnail paths from the shared App Group.
/// The id MUST match plugins/withOjoAppGroup.js, expo-target.config.js, and the
/// native bridge module (OjoWidgetBridgeModule.swift).
enum SnapshotStore {
  static let appGroup = "group.com.ojostudio.ojo"
  static let fileName = "snapshot.json"

  static func containerURL() -> URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
  }

  static func load() -> WidgetSnapshot? {
    guard let dir = containerURL() else { return nil }
    let url = dir.appendingPathComponent(fileName)
    guard let data = try? Data(contentsOf: url) else { return nil }
    return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
  }

  /// Absolute file URL for a container-relative thumbnail path, if resolvable.
  static func thumbURL(_ rel: String?) -> URL? {
    guard let rel = rel, !rel.isEmpty, let dir = containerURL() else { return nil }
    return dir.appendingPathComponent(rel)
  }
}
