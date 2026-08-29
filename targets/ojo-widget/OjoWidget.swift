import SwiftUI
import WidgetKit

@main
struct OjoWidgetBundle: WidgetBundle {
  var body: some Widget {
    OjoWidget()
    OjoTripCountdownWidget()
    OjoTomorrowWidget()
    OjoLayerTimelineWidget()
    OjoUVSunsetWidget()
  }
}

struct OjoWidget: Widget {
  let kind = "OjoWidget"

  /// iOS 17 also applies its own automatic content margin around widget
  /// content, on top of whatever padding the view itself adds — the small
  /// family's `.padding(10)` (now `.padding(16)`, see `ojoSmallPadding`) was
  /// never the WHOLE inset, it was stacked on top of a system margin we never
  /// measured or accounted for. `contentMarginsDisabled()` turns that system
  /// contribution off, so every family's inset is exactly what its own
  /// `.padding(...)` says — no hidden addition, no guessing. iOS 16 never had
  /// a system margin to begin with, so the two branches converge on the same
  /// on-screen result.
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: OjoProvider()) { entry in
      OjoWidgetView(entry: entry)
    }
    .configurationDisplayName("Today's Outfit")
    .description("Your Ojo outfit for today — and your trip look when you're traveling.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    // No `#available` needed: contentMarginsDisabled() is available from
    // iOS 15.0 and does its own internal version check — a no-op pre-17,
    // where real content margins don't exist to disable. An earlier attempt
    // at this used our own `if #available(iOS 17.0, *) { ... } else { ... }`
    // around two branches ending in different opaque `some WidgetConfiguration`
    // chains — that does NOT compile (confirmed by a real build failure):
    // WidgetConfigurationBuilder cannot unify two differently-typed opaque
    // branches the way ViewBuilder can for `some View`.
    .contentMarginsDisabled()
  }
}
