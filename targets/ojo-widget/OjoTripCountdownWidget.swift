import SwiftUI
import WidgetKit

struct OjoTripCountdownWidget: Widget {
  let kind = "OjoTripCountdownWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: TripCountdownProvider()) { entry in
      TripCountdownWidgetView(entry: entry)
    }
    .configurationDisplayName("Trip Countdown")
    .description("Days until your next trip, and how much of your packing list is done.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
