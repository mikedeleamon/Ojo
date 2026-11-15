import AppIntents
import SwiftUI
import UIKit

// Siri, Shortcuts and Spotlight: "What should I wear in Ojo?"
//
// Both intents answer in place, without opening the app, from snapshot.json in
// the shared App Group — the same file the widgets read (Snapshot.swift is
// compiled into this target too). The app rewrites it whenever the outfit or
// weather changes, and background refresh keeps it current while the app is
// closed. App Shortcuts must be declared in the main app, not the widget
// extension; plugins/withSiriShortcuts.js adds this file to the app target.

// MARK: - Answer

/// What Siri says and the card it shows. Built from the snapshot alone, so it
/// is plain data and easy to reason about.
struct OutfitAnswer {
  /// The full spoken (and printed) reply.
  var spoken: String
  /// Card heading, e.g. "Today in Placerville".
  var heading: String
  /// Short weather readout for the card, e.g. "50° · Rain".
  var weatherLine: String?
  var items: [WidgetSnapshot.Item]
  /// Layering advice, shown under the photos.
  var note: String?

  static func message(_ text: String, heading: String = "Ojo") -> OutfitAnswer {
    OutfitAnswer(spoken: text, heading: heading, weatherLine: nil, items: [], note: nil)
  }

  // MARK: Today

  static func today(_ snapshot: WidgetSnapshot?, now: Date = Date(), calendar: Calendar = .current) -> OutfitAnswer {
    guard let snap = snapshot else {
      return .message("Open Ojo once and I'll be able to tell you what to wear.")
    }
    let todayKey = dayKey(now, calendar)

    guard let written = parseISO(snap.updatedAt), calendar.isDate(written, inSameDayAs: now) else {
      // No snapshot from today yet, but last night's "tomorrow" plan is today's.
      if let t = snap.tomorrow, t.date == todayKey, let items = t.items, !items.isEmpty {
        return day(t, city: snap.weather?.city, label: "Today")
      }
      return .message("I don't have today's forecast yet. Open Ojo and I'll pick your outfit.")
    }

    let city = snap.weather?.city
    let heading = city.map { "Today in \($0)" } ?? "Today"
    var parts: [String] = []
    if let w = snap.weather {
      var s = "It's \(w.temp)°"
      if let city { s += " in \(city)" }
      if let c = w.condition, !c.isEmpty { s += ", \(c.lowercased())" }
      if let f = w.feelsLike, abs(f - w.temp) >= 5 { s += ", feels like \(f)°" }
      parts.append(s + ".")
    }

    if snap.mode == .empty {
      parts.append(emptyAdvice(snap.emptyReason))
      return OutfitAnswer(
        spoken: parts.joined(separator: " "),
        heading: heading,
        weatherLine: weatherLine(snap.weather),
        items: [],
        note: nil
      )
    }

    let pieces = spokenList(snap.items)
    if snap.worn == true {
      parts.append(pieces.map { "You're wearing \($0) today." } ?? "You've already logged today's outfit.")
    } else if snap.mode == .trip, let trip = snap.trip {
      let lead = "Day \(trip.dayIndex) of \(trip.dayTotal) in \(trip.destination)"
      parts.append(pieces.map { "\(lead): wear \($0)." } ?? "\(lead): \(sentence(snap.headline))")
    } else {
      parts.append(pieces.map { "Wear \($0)." } ?? sentence(snap.headline))
    }

    var note: String? = nil
    if snap.worn != true {
      note = snap.layerNote.map(sentence)
      if let n = note { parts.append(n) }
      if let extra = alertAdvice(snap.alerts, uvText: snap.uvIndexText, note: note) {
        parts.append(extra)
        note = [note, extra].compactMap { $0 }.joined(separator: " ")
      }
    }

    return OutfitAnswer(
      spoken: parts.joined(separator: " "),
      heading: heading,
      weatherLine: weatherLine(snap.weather),
      items: snap.items,
      note: note
    )
  }

  // MARK: Tomorrow

  static func tomorrow(_ snapshot: WidgetSnapshot?, now: Date = Date(), calendar: Calendar = .current) -> OutfitAnswer {
    guard let snap = snapshot else {
      return .message("Open Ojo once and I'll be able to tell you what to wear.")
    }
    guard
      let next = calendar.date(byAdding: .day, value: 1, to: now),
      let t = snap.tomorrow, t.date == dayKey(next, calendar)
    else {
      return .message("I don't have tomorrow's forecast yet. Open Ojo and I'll plan it.")
    }
    return day(t, city: snap.weather?.city, label: "Tomorrow")
  }

  /// A forecast day from the Tomorrow block — used for tomorrow, and for today
  /// when the only fresh plan is the one written last night.
  private static func day(_ t: WidgetSnapshot.TomorrowBlock, city: String?, label: String) -> OutfitAnswer {
    var weather = "\(label)\(city.map { " in \($0)" } ?? "")"
    if let c = t.condition, !c.isEmpty { weather += ": \(c.lowercased()), high" } else { weather += ": high" }
    weather += " \(t.high)°, low \(t.low)°"
    if let r = t.rainChance, r >= 30 { weather += ", \(r)% chance of rain" }
    var parts = [weather + "."]

    let items = t.items ?? []
    if items.isEmpty {
      parts.append("Open Ojo and I'll pick an outfit for it.")
    } else {
      parts.append(spokenList(items).map { "Wear \($0)." } ?? sentence(t.headline ?? "Ojo has an outfit ready."))
    }
    let note = items.isEmpty ? nil : t.layerNote.map(sentence)
    if let note { parts.append(note) }

    var line = "\(t.high)° / \(t.low)°"
    if let c = t.condition, !c.isEmpty { line += " · \(c)" }
    if let r = t.rainChance, r >= 30 { line += " · \(r)%" }

    return OutfitAnswer(
      spoken: parts.joined(separator: " "),
      heading: "\(label)\(city.map { " in \($0)" } ?? "")",
      weatherLine: line,
      items: items,
      note: note
    )
  }

  // MARK: Helpers

  /// "Grey Hoodie, Levi 513 and Black Adidas", or nil when the snapshot
  /// predates item names (the caller falls back to the outfit headline).
  static func spokenList(_ items: [WidgetSnapshot.Item]) -> String? {
    let names = items.compactMap { $0.name?.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    guard !names.isEmpty, names.count == items.count else { return nil }
    switch names.count {
    case 1: return names[0]
    case 2: return "\(names[0]) and \(names[1])"
    default: return names.dropLast().joined(separator: ", ") + " and " + names[names.count - 1]
    }
  }

  private static func emptyAdvice(_ reason: String?) -> String {
    switch reason {
    case "no_closet": return "Pick a closet in Ojo and I'll suggest outfits."
    case "empty_closet": return "Your closet is empty. Add a few pieces in Ojo and I'll pick outfits for you."
    default: return "Add a few more pieces to your closet in Ojo so I can put a full outfit together."
    }
  }

  /// Accessory gaps the outfit doesn't cover, unless the layering note already said so.
  private static func alertAdvice(_ alerts: [String]?, uvText: String?, note: String?) -> String? {
    let said = (note ?? "").lowercased()
    var out: [String] = []
    for alert in alerts ?? [] {
      switch alert {
      case "rain" where !said.contains("umbrella") && !said.contains("rain"):
        out.append("Bring an umbrella.")
      case "uv" where !said.contains("sunscreen"):
        out.append(uvText.map { "UV is \($0.lowercased()), so wear sunscreen." } ?? "Wear sunscreen.")
      default:
        break
      }
    }
    return out.isEmpty ? nil : out.joined(separator: " ")
  }

  private static func weatherLine(_ w: WidgetSnapshot.WeatherBlock?) -> String? {
    guard let w else { return nil }
    var line = "\(w.temp)°"
    if let c = w.condition, !c.isEmpty { line += " · \(c)" }
    if let h = w.high, let l = w.low { line += " · H \(h)° L \(l)°" }
    return line
  }

  private static func sentence(_ s: String) -> String {
    let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let last = t.last else { return t }
    return ".!?".contains(last) ? t : t + "."
  }

  static func dayKey(_ date: Date, _ calendar: Calendar) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
  }

  /// JS writes `toISOString()`, which has milliseconds; accept either form.
  static func parseISO(_ s: String) -> Date? {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = f.date(from: s) { return d }
    f.formatOptions = [.withInternetDateTime]
    return f.date(from: s)
  }
}

// MARK: - Card

struct OutfitSnippetView: View {
  let answer: OutfitAnswer

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .firstTextBaseline) {
        Text(answer.heading).font(.headline)
        Spacer(minLength: 8)
        if let line = answer.weatherLine {
          Text(line).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
        }
      }
      if !answer.items.isEmpty {
        HStack(alignment: .top, spacing: 8) {
          ForEach(Array(answer.items.prefix(4).enumerated()), id: \.offset) { _, item in
            VStack(spacing: 4) {
              Thumb(item: item)
              Text(item.name ?? item.role.capitalized)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
          }
        }
      }
      if let note = answer.note {
        Text(note).font(.footnote).foregroundStyle(.secondary)
      }
    }
    .padding()
  }

  private struct Thumb: View {
    let item: WidgetSnapshot.Item

    var body: some View {
      ZStack {
        RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.secondary.opacity(0.15))
        if let url = SnapshotStore.thumbURL(item.thumb), let image = UIImage(contentsOfFile: url.path) {
          Image(uiImage: image).resizable().scaledToFill()
        } else {
          Image(systemName: "tshirt").foregroundStyle(.secondary)
        }
      }
      .frame(height: 76)
      .frame(maxWidth: 76)
      .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
  }
}

// MARK: - Intents

@available(iOS 17.0, *)
struct WhatToWearTodayIntent: AppIntent {
  static var title: LocalizedStringResource = "What Should I Wear Today"
  static var description = IntentDescription("Ojo tells you what to wear for today's weather.")
  static var openAppWhenRun = false

  func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
    let answer = OutfitAnswer.today(SnapshotStore.load())
    return .result(dialog: IntentDialog("\(answer.spoken)"), view: OutfitSnippetView(answer: answer))
  }
}

@available(iOS 17.0, *)
struct WhatToWearTomorrowIntent: AppIntent {
  static var title: LocalizedStringResource = "What Should I Wear Tomorrow"
  static var description = IntentDescription("Ojo tells you what to wear for tomorrow's forecast.")
  static var openAppWhenRun = false

  func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
    let answer = OutfitAnswer.tomorrow(SnapshotStore.load())
    return .result(dialog: IntentDialog("\(answer.spoken)"), view: OutfitSnippetView(answer: answer))
  }
}

/// Every phrase must name the app; Siri doesn't allow app-less phrases.
@available(iOS 17.0, *)
struct OjoShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: WhatToWearTodayIntent(),
      phrases: [
        "What should I wear in \(.applicationName)",
        "What should I wear today in \(.applicationName)",
        "Ask \(.applicationName) what to wear",
        "What does \(.applicationName) say I should wear",
        "\(.applicationName) outfit",
      ],
      shortTitle: "What to Wear",
      systemImageName: "tshirt"
    )
    AppShortcut(
      intent: WhatToWearTomorrowIntent(),
      phrases: [
        "What should I wear tomorrow in \(.applicationName)",
        "Ask \(.applicationName) what to wear tomorrow",
        "\(.applicationName) outfit for tomorrow",
      ],
      shortTitle: "Tomorrow's Outfit",
      systemImageName: "moon.stars"
    )
  }
}
