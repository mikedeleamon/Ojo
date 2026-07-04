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
  let items: [Item]
  let trip: TripInfo?
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
}

extension WidgetSnapshot {
  /// Gallery / pre-data sample shown before the app writes a real snapshot.
  static let placeholder = WidgetSnapshot(
    mode: .today,
    updatedAt: "",
    headline: "Today's Outfit",
    tempLine: "72° · Clear",
    items: [
      Item(id: "1", role: "top", thumb: nil),
      Item(id: "2", role: "bottom", thumb: nil),
      Item(id: "3", role: "footwear", thumb: nil),
    ],
    trip: nil,
    deepLink: "ojo://outfit"
  )

  /// Fallback when no snapshot has been written yet (or it failed to decode).
  static let empty = WidgetSnapshot(
    mode: .empty,
    updatedAt: "",
    headline: "",
    tempLine: nil,
    items: [],
    trip: nil,
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
