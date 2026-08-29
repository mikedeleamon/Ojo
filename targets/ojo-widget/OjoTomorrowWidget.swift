import SwiftUI
import WidgetKit

struct OjoTomorrowWidget: Widget {
  let kind = "OjoTomorrowWidget"

  /// See OjoWidget's identical comment — same system-margin-stacking issue,
  /// same fix. This widget reuses `ojoSmallPadding` for its small family, so
  /// it needs the same `contentMarginsDisabled()` to make that padding the
  /// whole inset rather than an addition on top of an unmeasured system one.
  var body: some WidgetConfiguration {
    // See OjoWidget's identical comment: contentMarginsDisabled() guards its
    // own availability internally (iOS 15.0+, no-op pre-17) — no
    // `#available` needed here, and an `if/else` around two differently-typed
    // opaque branches does not compile for WidgetConfiguration.
    StaticConfiguration(kind: kind, provider: TomorrowProvider()) { entry in
      TomorrowWidgetView(entry: entry)
    }
    .configurationDisplayName("Tomorrow Prep")
    .description("Today's fit by day — tomorrow's outfit and forecast after 6 PM, so you can lay it out tonight.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}
