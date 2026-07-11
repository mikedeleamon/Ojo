import SwiftUI
import WidgetKit

struct OjoTomorrowWidget: Widget {
  let kind = "OjoTomorrowWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: TomorrowProvider()) { entry in
      TomorrowWidgetView(entry: entry)
    }
    .configurationDisplayName("Tomorrow Prep")
    .description("Today's fit by day — tomorrow's outfit and forecast after 6 PM, so you can lay it out tonight.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
