import SwiftUI
import WidgetKit

/// Layer Timeline: the full day's layer changes as a readable list — the main
/// widget compresses these into an icon strip; this widget is for the days you
/// want the actual words ("Remove your denim jacket — warming up") and all 5
/// steps, not the soonest 3. Shares OjoProvider: same snapshot, same refresh.
struct OjoLayerTimelineWidget: Widget {
  let kind = "OjoLayerTimeline"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: OjoProvider()) { entry in
      LayerTimelineWidgetView(entry: entry)
    }
    .configurationDisplayName("Layer Timeline")
    .description("When to add or drop layers as today's weather shifts.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

// MARK: - Root

struct LayerTimelineWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: OjoProvider.Entry

  var body: some View {
    content
      .widgetURL(URL(string: entry.snapshot.deepLink))
      .ojoWidgetBackground(entry.snapshot, family: family)
  }

  @ViewBuilder private var content: some View {
    let snap = entry.snapshot
    if snap.mode == .empty {
      EmptyStateView(snap: snap)
    } else if family == .systemLarge {
      TimelineLargeView(snap: snap)
    } else {
      TimelineMediumView(snap: snap)
    }
  }
}

/// The steps this widget renders: the uncapped list when the snapshot carries
/// it, else the main widget's capped strip (older snapshot), else nil — most
/// days have no timeline at all (steady weather) and get the steady state.
private func timelineSteps(_ snap: WidgetSnapshot) -> [WidgetSnapshot.TimelineStep]? {
  let steps = snap.fullTimeline ?? snap.timeline
  return (steps?.isEmpty == false) ? steps : nil
}

// MARK: - Pieces

/// Compact header: city + current temp + condition icon on one line — enough
/// context to anchor the timeline without competing with it.
private struct TimelineHeaderView: View {
  let snap: WidgetSnapshot

  var body: some View {
    HStack(alignment: .center, spacing: 6) {
      if let city = snap.weather?.city, !city.isEmpty {
        Text(city)
          .font(.system(size: 11, weight: .bold))
          .foregroundStyle(.white.opacity(0.85))
          .lineLimit(1)
      }
      Spacer(minLength: 4)
      if let w = snap.weather {
        Text("\(w.temp)°")
          .font(.system(size: 15, weight: .semibold, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(.white)
      }
      WeatherIconView(kind: snap.weatherKind, isDay: snap.isDay, size: 16)
    }
  }
}

/// One step, spelled out: icon, the time bucket as a label line, the full
/// action text under it — the whole point of this widget over the icon strip.
private struct TimelineRowView: View {
  let step: WidgetSnapshot.TimelineStep

  var body: some View {
    HStack(alignment: .top, spacing: 8) {
      Image(systemName: timelineActionIcon(step.action))
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(Color.ojoAccent)
        .frame(width: 18, alignment: .center)
        .padding(.top, 1)
      VStack(alignment: .leading, spacing: 1) {
        Text(step.time.uppercased())
          .font(.system(size: 9, weight: .bold))
          .tracking(0.6)
          .foregroundStyle(.white.opacity(0.6))
        Text(step.action)
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(.white)
          .lineLimit(1)
          .minimumScaleFactor(0.85)
      }
      Spacer(minLength: 0)
    }
  }
}

/// Most days have no layer changes — say so instead of looking broken, and
/// keep the layering recommendation as the useful line.
private struct SteadyDayView: View {
  let snap: WidgetSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack(spacing: 6) {
        Image(systemName: "checkmark.circle.fill")
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(Color.ojoAccent)
        Text("Steady all day — no layer changes")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(.white)
          .lineLimit(1)
      }
      if let note = snap.layerNote, !note.isEmpty {
        Text(note)
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(.white.opacity(0.8))
          .lineLimit(2)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
  }
}

// MARK: - Medium

/// Header line, then up to 3 steps (the medium family's vertical budget).
private struct TimelineMediumView: View {
  let snap: WidgetSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      TimelineHeaderView(snap: snap)
      if let steps = timelineSteps(snap) {
        ForEach(Array(steps.prefix(3)), id: \.id) { TimelineRowView(step: $0) }
      } else {
        Spacer(minLength: 0)
        SteadyDayView(snap: snap)
      }
      Spacer(minLength: 0)
    }
    .padding(12)
  }
}

// MARK: - Large

/// Room for the whole day: header, layering recommendation, every step (up to
/// layeringEngine's 5), sunset as the closer.
private struct TimelineLargeView: View {
  let snap: WidgetSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      TimelineHeaderView(snap: snap)

      if let note = snap.layerNote, !note.isEmpty {
        Text(note)
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(.white)
          .lineLimit(2)
          .fixedSize(horizontal: false, vertical: true)
      }

      if let steps = timelineSteps(snap) {
        VStack(alignment: .leading, spacing: 9) {
          ForEach(Array(steps.prefix(5)), id: \.id) { TimelineRowView(step: $0) }
        }
      } else {
        Spacer(minLength: 0)
        SteadyDayView(snap: snap)
      }

      Spacer(minLength: 0)

      if let sunset = snap.weather?.sunset {
        HStack(spacing: 4) {
          Image(systemName: "sunset.fill")
            .font(.system(size: 10))
          Text("Sunset \(sunset)")
            .font(.system(size: 11, weight: .semibold))
        }
        .foregroundStyle(.white.opacity(0.75))
      }
    }
    .padding(16)
  }
}
