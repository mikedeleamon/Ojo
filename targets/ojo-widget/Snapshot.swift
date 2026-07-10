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
  /// Structured weather readout for the hero-temperature layout. Optional —
  /// pre-redesign snapshots lack it; views fall back to `tempLine`.
  let weather: WeatherBlock?
  /// Mirrors lib/weather/conditions.ts WeatherKind. Optional (rather than
  /// required) so a snapshot written before this field existed still decodes —
  /// WeatherGradient.swift falls back to a neutral gradient when nil.
  let weatherKind: String?
  let isDay: Bool?
  let items: [Item]
  /// All renderable outfits for today, primary first — the "Change fit" intent
  /// cycles them. Optional: empty mode and pre-variant snapshots omit it, in
  /// which case the top-level fields are the only variant.
  let variants: [Variant]?
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

  /// Mirrors snapshot.types.ts `OjoWidgetWeather`. Values arrive pre-converted
  /// to the user's unit; Swift only renders. Everything but `temp`/`unit` is
  /// optional so a partial readout (e.g. no daily forecast) still decodes.
  struct WeatherBlock: Codable {
    let city: String?       // "New York" — nil when unresolved
    let temp: Int
    let feelsLike: Int?
    let high: Int?
    let low: Int?
    let unit: String        // "F" | "C"
    let condition: String?  // "Partly Cloudy"
    let rainChance: Int?    // 0–100
    let uvText: String?     // "Low"…"Extreme"
    let sunset: String?     // "8:14 PM"
  }

  /// Mirrors snapshot.types.ts `WidgetOutfitVariant` — one complete outfit the
  /// widget can render. Index 0 mirrors the snapshot's top-level fields.
  struct Variant: Codable {
    let headline: String
    let items: [Item]
    let layerNote: String?
    let alerts: [String]?
    let uvIndexText: String?
    let timeline: [TimelineStep]?
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
    /// Arrival-day forecast peek. Optional so pre-feature snapshots still decode.
    let weather: TripWeather?
    /// Short note when a fresh forecast has drifted from the saved plan; nil when they agree.
    let driftNote: String?

    /// Mirrors snapshot.types.ts `OjoWidgetUpcomingTripWeather`. Temps arrive
    /// pre-converted to the user's unit; Swift only renders.
    struct TripWeather: Codable {
      let high: Int
      let low: Int
      let unit: String        // "F" | "C"
      let condition: String?  // "Clear"
      let weatherKind: String? // conditions.ts WeatherKind, for the SF Symbol picker
      let precip: Bool
    }
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
  /// How many outfits the "Change fit" intent can cycle through — never 0, so
  /// `index % variantCount` is always safe.
  var variantCount: Int { max(variants?.count ?? 1, 1) }

  /// Returns a copy whose top-level outfit fields (headline/items/layerNote/
  /// alerts/uvIndexText/timeline) are replaced by `variants[index mod count]`,
  /// so every view keeps reading the same top-level fields regardless of which
  /// fit the user has cycled to. Index 0 / missing variants → self unchanged.
  func applyingVariant(_ index: Int) -> WidgetSnapshot {
    guard let variants = variants, !variants.isEmpty else { return self }
    let v = variants[((index % variants.count) + variants.count) % variants.count]
    return WidgetSnapshot(
      mode: mode,
      updatedAt: updatedAt,
      headline: v.headline,
      tempLine: tempLine,
      weather: weather,
      weatherKind: weatherKind,
      isDay: isDay,
      items: v.items,
      variants: variants,
      layerNote: v.layerNote,
      alerts: v.alerts,
      uvIndexText: v.uvIndexText,
      timeline: v.timeline,
      emptyReason: emptyReason,
      trip: trip,
      upcomingTrip: upcomingTrip,
      deepLink: deepLink
    )
  }

  /// Gallery / pre-data sample shown before the app writes a real snapshot.
  static let placeholder = WidgetSnapshot(
    mode: .today,
    updatedAt: "",
    headline: "Today's Outfit",
    tempLine: "72° · Clear",
    weather: WeatherBlock(
      city: "New York",
      temp: 72,
      feelsLike: 74,
      high: 78,
      low: 61,
      unit: "F",
      condition: "Clear",
      rainChance: 10,
      uvText: "High",
      sunset: "8:14 PM"
    ),
    weatherKind: "clear",
    isDay: true,
    items: [
      Item(id: "1", role: "top", thumb: nil),
      Item(id: "2", role: "bottom", thumb: nil),
      Item(id: "3", role: "footwear", thumb: nil),
    ],
    variants: nil,
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
    weather: nil,
    weatherKind: nil,
    isDay: nil,
    items: [],
    variants: nil,
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
