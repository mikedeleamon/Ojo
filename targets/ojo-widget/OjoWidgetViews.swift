import SwiftUI
import WidgetKit

// Ojo brand green (#87DE5A), used as the accent for trip/empty states.
extension Color {
  static let ojoAccent = Color(red: 0x87 / 255, green: 0xDE / 255, blue: 0x5A / 255)
}

/// iOS 17 requires widgets to declare their background via `containerBackground`;
/// fall back to a plain background on 15–16.
extension View {
  @ViewBuilder
  func ojoWidgetBackground() -> some View {
    if #available(iOS 17.0, *) {
      containerBackground(for: .widget) { Color(.systemBackground) }
    } else {
      background(Color(.systemBackground))
    }
  }
}

// MARK: - Root

struct OjoWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: OjoProvider.Entry

  var body: some View {
    content
      .widgetURL(URL(string: entry.snapshot.deepLink))
      .ojoWidgetBackground()
  }

  @ViewBuilder private var content: some View {
    let snap = entry.snapshot
    switch snap.mode {
    case .empty:
      EmptyStateView()
    case .today, .trip:
      if family == .systemSmall {
        SmallOutfitView(snap: snap)
      } else {
        MediumOutfitView(snap: snap)
      }
    }
  }
}

// MARK: - Thumbnail

/// Loads a cached garment thumbnail from the App Group; shows a neutral tile
/// when the image isn't cached yet.
struct ThumbView: View {
  let item: WidgetSnapshot.Item

  var body: some View {
    ZStack {
      if let url = SnapshotStore.thumbURL(item.thumb),
         let data = try? Data(contentsOf: url),
         let ui = UIImage(data: data) {
        Image(uiImage: ui)
          .resizable()
          .aspectRatio(contentMode: .fill)
      } else {
        Rectangle()
          .fill(Color.secondary.opacity(0.12))
          .overlay(
            Image(systemName: "photo")
              .font(.system(size: 15))
              .foregroundStyle(.secondary)
          )
      }
    }
    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
  }
}

// MARK: - Shared pieces

struct TripBadge: View {
  let trip: WidgetSnapshot.TripInfo

  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: trip.locationConfirmed ? "location.fill" : "airplane")
        .font(.system(size: 9))
      Text("Day \(trip.dayIndex) of \(trip.dayTotal) · \(trip.destination)")
        .font(.system(size: 11, weight: .semibold))
        .lineLimit(1)
    }
    .foregroundStyle(Color.ojoAccent)
  }
}

private func headlineText(_ snap: WidgetSnapshot) -> String {
  snap.headline.isEmpty ? "Today's Outfit" : snap.headline
}

// MARK: - Medium

struct MediumOutfitView: View {
  let snap: WidgetSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      VStack(alignment: .leading, spacing: 2) {
        if snap.mode == .trip, let trip = snap.trip {
          TripBadge(trip: trip)
        }
        Text(headlineText(snap))
          .font(.headline)
          .lineLimit(1)
        if let temp = snap.tempLine, !temp.isEmpty {
          Text(temp)
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
      }

      if snap.items.isEmpty {
        Text("No outfit yet")
          .font(.caption)
          .foregroundStyle(.secondary)
      } else {
        HStack(spacing: 6) {
          ForEach(Array(snap.items.prefix(4))) { item in
            ThumbView(item: item)
              .aspectRatio(0.8, contentMode: .fit)
          }
        }
      }

      if snap.mode == .trip, let drift = snap.trip?.driftNote, !drift.isEmpty {
        Text(drift)
          .font(.system(size: 10))
          .foregroundStyle(.secondary)
          .lineLimit(2)
      }

      Spacer(minLength: 0)
    }
    .padding(12)
  }
}

// MARK: - Small

struct SmallOutfitView: View {
  let snap: WidgetSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      if snap.mode == .trip, let trip = snap.trip {
        TripBadge(trip: trip)
      } else if let temp = snap.tempLine, !temp.isEmpty {
        Text(temp)
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }

      HStack(spacing: 4) {
        ForEach(Array(snap.items.prefix(3))) { item in
          ThumbView(item: item)
            .aspectRatio(0.7, contentMode: .fit)
        }
      }

      Spacer(minLength: 0)

      Text(headlineText(snap))
        .font(.system(size: 12, weight: .semibold))
        .lineLimit(1)
    }
    .padding(10)
  }
}

// MARK: - Empty

struct EmptyStateView: View {
  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: "eye")
        .font(.system(size: 22))
        .foregroundStyle(Color.ojoAccent)
      Text("Add clothes to see today's outfit")
        .font(.caption)
        .multilineTextAlignment(.center)
        .foregroundStyle(.secondary)
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}
