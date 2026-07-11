import SwiftUI
import WidgetKit

// MARK: - Root

/// Tomorrow Prep: today's outfit during the day, tomorrow's outfit + forecast
/// after the 6 PM flip (see TomorrowProvider). The day phase intentionally
/// renders the SAME content as the main widget — this widget's value is the
/// evening, and a second "today" treatment before 6 PM would just disagree
/// with the widget next to it.
struct TomorrowWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: TomorrowEntry

  /// The tomorrow block, but only when it still describes calendar-tomorrow.
  /// A snapshot written yesterday evening carries a "tomorrow" that became
  /// today at midnight — showing that under a TOMORROW badge would be wrong,
  /// so a stale block falls back to the today phase instead. The empty-date
  /// case is the gallery placeholder.
  private var activeTomorrow: WidgetSnapshot.TomorrowBlock? {
    guard entry.showTomorrow, let t = entry.snapshot.tomorrow else { return nil }
    if t.date.isEmpty { return t }
    guard let tm = Calendar.current.date(byAdding: .day, value: 1, to: Date()) else { return nil }
    return t.date == localISODateString(tm) ? t : nil
  }

  var body: some View {
    if let t = activeTomorrow {
      tomorrowContent(t)
        .widgetURL(URL(string: entry.snapshot.deepLink))
        .tomorrowWidgetBackground(t)
    } else {
      todayContent
        .widgetURL(URL(string: entry.snapshot.deepLink))
        .ojoWidgetBackground(entry.snapshot, family: family)
    }
  }

  @ViewBuilder private func tomorrowContent(_ t: WidgetSnapshot.TomorrowBlock) -> some View {
    switch family {
    case .systemSmall:
      TomorrowSmallView(t: t)
    case .systemLarge, .systemExtraLarge:
      TomorrowLargeView(t: t)
    default:
      TomorrowMediumView(t: t)
    }
  }

  @ViewBuilder private var todayContent: some View {
    let snap = entry.snapshot
    switch snap.mode {
    case .empty:
      EmptyStateView(snap: snap)
    case .today, .trip:
      switch family {
      case .systemSmall:
        SmallOutfitView(snap: snap)
      case .systemLarge, .systemExtraLarge:
        LargeOutfitView(snap: snap)
      default:
        MediumOutfitView(snap: snap)
      }
    }
  }
}

/// Local "yyyy-MM-dd", matching the JS side's localISODate (buildInput.ts).
private func localISODateString(_ date: Date) -> String {
  let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
  return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

/// Tomorrow phase backdrop: the weather gradient keyed to TOMORROW's
/// conditions (daytime variant — the block describes the day ahead, even
/// though it's viewed at night). Same scrim treatment as ojoWidgetBackground.
private extension View {
  @ViewBuilder
  func tomorrowWidgetBackground(_ t: WidgetSnapshot.TomorrowBlock) -> some View {
    let gradient = LinearGradient(
      colors: WeatherGradient.colors(kind: t.weatherKind, isDay: true),
      startPoint: .top,
      endPoint: .bottom
    )
    if #available(iOS 17.0, *) {
      containerBackground(for: .widget) {
        gradient.overlay(Color.black.opacity(0.16))
      }
    } else {
      background(gradient.overlay(Color.black.opacity(0.16)))
    }
  }
}

// MARK: - Shared pieces

/// The phase marker — brand-accent pill, mirroring TripBadge's treatment so
/// "this isn't today" reads at a glance.
struct TomorrowBadge: View {
  let dayName: String
  /// Small family drops the day name; the badge alone carries the message.
  var compact: Bool = false

  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: "moon.stars.fill")
        .font(.system(size: 9))
      Text(compact ? "TOMORROW" : "TOMORROW · \(dayName.uppercased())")
        .font(.system(size: 10, weight: .bold))
        .tracking(0.6)
        .lineLimit(1)
    }
    .foregroundStyle(Color.ojoAccent)
  }
}

/// Tomorrow's hero is the H/L pair — there is no "current" temperature for a
/// day that hasn't started. High leads at hero size, low trails smaller and
/// dimmer, both in the rounded monospaced style of TempHeroView.
struct TomorrowHiLoView: View {
  let t: WidgetSnapshot.TomorrowBlock
  var size: CGFloat = 34

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 5) {
      Text("\(t.high)°")
        .font(.system(size: size, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(.white)
      Text("\(t.low)°")
        .font(.system(size: size * 0.55, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(.white.opacity(0.55))
    }
  }
}

/// Rain-chance capsule, same frosted treatment as the main widget's chips.
/// Only rendered at >= 20% — mirrors signalChips' ambient-rain threshold.
struct TomorrowRainChip: View {
  let t: WidgetSnapshot.TomorrowBlock

  var body: some View {
    if let rc = t.rainChance, rc >= 20 {
      HStack(spacing: 3) {
        Image(systemName: "umbrella.fill")
          .font(.system(size: 8, weight: .semibold))
        Text("RAIN \(rc)%")
          .font(.system(size: 9, weight: .semibold))
          .tracking(0.4)
      }
      .padding(.horizontal, 7)
      .padding(.vertical, 3)
      .background(Capsule().fill(Color.white.opacity(0.18)))
      .foregroundStyle(.white)
      .lineLimit(1)
    }
  }
}

/// Weather-only fallback when tomorrow's generation produced no wearable fit —
/// the forecast still shows, with a nudge instead of thumbnails.
private struct TomorrowNudgeView: View {
  var body: some View {
    Text("Open Ojo to build tomorrow's fit")
      .font(.system(size: 11, weight: .medium))
      .foregroundStyle(.white.opacity(0.75))
      .fixedSize(horizontal: false, vertical: true)
  }
}

private func tomorrowHeadline(_ t: WidgetSnapshot.TomorrowBlock) -> String {
  t.headline ?? "Tomorrow's Outfit"
}

// MARK: - Small

/// One glance: TOMORROW badge, icon + H/L, the outfit strip, headline.
struct TomorrowSmallView: View {
  let t: WidgetSnapshot.TomorrowBlock

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      TomorrowBadge(dayName: t.dayName, compact: true)
      HStack(alignment: .center) {
        WeatherIconView(kind: t.weatherKind, isDay: true, size: 24)
        Spacer(minLength: 4)
        TomorrowHiLoView(t: t, size: 24)
      }

      if let items = t.items, !items.isEmpty {
        OutfitThumbRow(items: items, maxCount: 3, ratio: 0.7, spacing: 4, minHeight: 44)
        Spacer(minLength: 0)
        Text(tomorrowHeadline(t))
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(.white)
          .lineLimit(1)
      } else {
        Spacer(minLength: 0)
        TomorrowNudgeView()
        Spacer(minLength: 0)
      }
    }
    .padding(10)
  }
}

// MARK: - Medium

/// The main widget's split, re-anchored on tomorrow: forecast column on the
/// left (badge, H/L, condition + rain, layer note), outfit tiles on the right.
struct TomorrowMediumView: View {
  let t: WidgetSnapshot.TomorrowBlock

  private var conditionLine: String? {
    guard let c = t.condition, !c.isEmpty else { return nil }
    return c
  }

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      VStack(alignment: .leading, spacing: 4) {
        TomorrowBadge(dayName: t.dayName)
        HStack(alignment: .center, spacing: 6) {
          TomorrowHiLoView(t: t, size: 30)
          WeatherIconView(kind: t.weatherKind, isDay: true, size: 28)
        }
        if let cond = conditionLine {
          Text(cond)
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(.white.opacity(0.75))
            .lineLimit(1)
        }

        if t.items?.isEmpty == false {
          Text(tomorrowHeadline(t))
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(.white)
            .lineLimit(1)
          if let note = t.layerNote, !note.isEmpty {
            Text(note)
              .font(.system(size: 10, weight: .medium))
              .foregroundStyle(.white.opacity(0.85))
              .lineLimit(2)
              .fixedSize(horizontal: false, vertical: true)
          }
        } else {
          TomorrowNudgeView()
        }

        Spacer(minLength: 0)
        TomorrowRainChip(t: t)
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      if let items = t.items, !items.isEmpty {
        OutfitThumbRow(items: items, maxCount: 3, ratio: 0.8, minHeight: 50)
          .frame(maxHeight: .infinity)
      }
    }
    .padding(12)
  }
}

// MARK: - Large

/// Full evening-prep layout: forecast header (H/L hero + condition left, rain
/// chip right), tomorrow's headline, big outfit tiles, and the layering note
/// as the "how to wear it" closer.
struct TomorrowLargeView: View {
  let t: WidgetSnapshot.TomorrowBlock

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      TomorrowBadge(dayName: t.dayName)

      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 2) {
          HStack(alignment: .center, spacing: 8) {
            TomorrowHiLoView(t: t, size: 40)
            WeatherIconView(kind: t.weatherKind, isDay: true, size: 36)
          }
          if let cond = t.condition, !cond.isEmpty {
            Text(cond)
              .font(.system(size: 12, weight: .medium))
              .foregroundStyle(.white.opacity(0.75))
              .lineLimit(1)
          }
        }
        Spacer(minLength: 8)
        TomorrowRainChip(t: t)
      }

      if let items = t.items, !items.isEmpty {
        Text(tomorrowHeadline(t))
          .font(.title3.weight(.semibold))
          .foregroundStyle(.white)
          .lineLimit(1)

        OutfitThumbRow(items: items, maxCount: 4, ratio: 0.8, spacing: 10, maxHeight: 170)
          .padding(.horizontal, 10)

        if let note = t.layerNote, !note.isEmpty {
          Text(note)
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(.white.opacity(0.85))
            .lineLimit(2)
            .fixedSize(horizontal: false, vertical: true)
        }
      } else {
        Spacer(minLength: 0)
        TomorrowNudgeView()
      }

      Spacer(minLength: 0)
    }
    .padding(16)
  }
}
