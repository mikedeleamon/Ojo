import AppIntents
import Foundation
import WidgetKit

/// Persistence for the "Change fit" cycling index, shared between the intent
/// (writes) and the provider (reads) via App Group UserDefaults.
///
/// The index is paired with the snapshot's `updatedAt` stamp: the widget can't
/// run the outfit engine, so "Change fit" only cycles the pre-written
/// `variants` — and whenever the app rewrites the snapshot (new outfits, a
/// weather refresh, a new day) the stored pair goes stale and the widget falls
/// back to the primary fit, which is the canonical answer for fresh data.
enum VariantIndexStore {
  static let indexKey = "ojoWidget.variantIndex"
  static let stampKey = "ojoWidget.variantStamp"

  /// The variant index to render for this snapshot — 0 unless the user has
  /// cycled fits since this exact snapshot was written.
  static func currentIndex(for snapshot: WidgetSnapshot) -> Int {
    guard let defaults = UserDefaults(suiteName: SnapshotStore.appGroup),
          defaults.string(forKey: stampKey) == snapshot.updatedAt
    else { return 0 }
    return defaults.integer(forKey: indexKey)
  }

  /// Step to the next fit for this snapshot (wrap-around happens at render
  /// time via `applyingVariant`'s modulo, so the raw count can only grow).
  static func advance(for snapshot: WidgetSnapshot) {
    guard let defaults = UserDefaults(suiteName: SnapshotStore.appGroup) else { return }
    defaults.set(currentIndex(for: snapshot) + 1, forKey: indexKey)
    defaults.set(snapshot.updatedAt, forKey: stampKey)
  }
}

/// The interactive "Change fit ›" button on the systemLarge widget — bumps the
/// variant index and reloads this widget's timeline, all inside the extension:
/// no app launch, no navigation (interactive widgets are iOS 17+; iOS 16 keeps
/// the whole-widget tap into the app instead).
@available(iOS 17.0, *)
struct ChangeFitIntent: AppIntent {
  static var title: LocalizedStringResource = "Change Fit"
  static var description = IntentDescription("Show another Ojo outfit for the same weather.")

  func perform() async throws -> some IntentResult {
    if let snap = SnapshotStore.load() {
      VariantIndexStore.advance(for: snap)
    }
    WidgetCenter.shared.reloadTimelines(ofKind: "OjoWidget")
    return .result()
  }
}
