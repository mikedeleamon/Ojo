import SwiftUI
import WidgetKit

@main
struct OjoWidgetBundle: WidgetBundle {
  var body: some Widget {
    OjoWidget()
    OjoTripCountdownWidget()
  }
}

struct OjoWidget: Widget {
  let kind = "OjoWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: OjoProvider()) { entry in
      OjoWidgetView(entry: entry)
    }
    .configurationDisplayName("Today's Outfit")
    .description("Your Ojo outfit for today — and your trip look when you're traveling.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}
