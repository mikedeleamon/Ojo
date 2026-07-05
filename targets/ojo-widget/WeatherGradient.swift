import SwiftUI

/// Mirrors src/lib/weather/conditions.ts's `WeatherKind` union. JS does the
/// substring classification once (classifyCondition) and sends the resolved
/// kind, so this enum can't drift from those ~15 substring rules — only the
/// color VALUES below are duplicated, a much smaller, rarer-changing surface.
enum WidgetWeatherKind: String {
  case thunderstorm, snow, ice, drizzle, rain, hot, fog, haze, sunny, clear
  case partlyCloudy, cloudy
}

/// Mirrors src/theme/tokens.ts `weatherGradients` + the gradient half of
/// src/lib/weather/conditions.ts `KIND_STYLES`. Keep both in sync if either
/// changes — see WidgetWeatherKind above for the drift-avoidance strategy.
enum WeatherGradient {
  private static func hex(_ s: String) -> Color {
    let v = UInt32(s, radix: 16) ?? 0
    return Color(
      red: Double((v >> 16) & 0xFF) / 255,
      green: Double((v >> 8) & 0xFF) / 255,
      blue: Double(v & 0xFF) / 255
    )
  }

  private static let palettes: [String: [String]] = [
    "sunny":        ["F97316", "FBBF24", "FDE68A"],
    "clearDay":     ["0284C7", "38BDF8", "7DD3FC"],
    "clearNight":   ["020617", "0C1445", "1D2B6B"],
    "hot":          ["7C2D12", "C2410C", "FBBF24"],
    "partlyCloudy": ["334155", "475569", "64748B"],
    "cloudy":       ["1F2937", "374151", "4B5563"],
    "drizzle":      ["0F2236", "1B4A7A", "4A90D9"],
    "rainy":        ["0C1A2E", "1E3A5F", "1D4ED8"],
    "stormy":       ["0F0C29", "1E1B4B", "302B63"],
    "snow":         ["5B8DB8", "93C5FD", "E0F2FE"],
    "ice":          ["0A1929", "1B3A5C", "3A7AB5"],
    "foggy":        ["374151", "6B7280", "9CA3AF"],
    "hazy":         ["3B2F1E", "7A6040", "BAA07A"],
    "default":      ["0F172A", "1E293B", "334155"],
  ]

  /// Resolves the same gradient `gradientFor` would in the JS app, given the
  /// classified WeatherKind + local daytime flag. Falls back to a neutral dark
  /// gradient for unknown/missing data (e.g. a stale pre-gradient snapshot).
  static func colors(kind rawKind: String?, isDay: Bool?) -> [Color] {
    let day = isDay ?? true
    let key: String
    switch WidgetWeatherKind(rawValue: rawKind ?? "") {
    case .thunderstorm: key = "stormy"
    case .snow:          key = "snow"
    case .ice:           key = "ice"
    case .drizzle:       key = "drizzle"
    case .rain:          key = "rainy"
    case .hot:           key = "hot"
    case .fog:           key = "foggy"
    case .haze:          key = "hazy"
    case .sunny:         key = "clearDay"
    case .clear:         key = day ? "clearDay" : "clearNight"
    case .partlyCloudy:  key = day ? "partlyCloudy" : "clearNight"
    case .cloudy:        key = "cloudy"
    case .none:          key = "default"
    }
    return (palettes[key] ?? palettes["default"]!).map(hex)
  }

  /// Mirrors the ICON half of `KIND_STYLES` (→ `iconTypeFor`, rendered by the
  /// in-app WeatherIconDisplay) — a SEPARATE lookup from `colors` above. E.g.
  /// fog uses the 'cloudy' icon despite the distinct 'foggy' gradient; that
  /// split is intentional in the JS source and must not be "fixed" here.
  static func sfSymbolName(kind rawKind: String?, isDay: Bool?) -> String {
    let day = isDay ?? true
    switch WidgetWeatherKind(rawValue: rawKind ?? "") {
    case .thunderstorm:   return "cloud.bolt.rain.fill"                    // storm
    case .snow, .ice:     return "snowflake"                               // snow
    case .drizzle, .rain: return "cloud.rain.fill"                         // rainy
    case .hot, .sunny:    return "sun.max.fill"                            // sunny
    case .fog, .cloudy:   return "cloud.fill"                             // cloudy
    case .haze:           return day ? "cloud.sun.fill" : "cloud.moon.fill" // partly-cloudy(-night)
    case .clear:          return day ? "sun.max.fill" : "moon.stars.fill"   // sunny / clear-night
    case .partlyCloudy:   return day ? "cloud.sun.fill" : "cloud.moon.fill" // partly-cloudy(-night)
    case .none:           return "cloud.fill"
    }
  }

  /// Same mapping as `sfSymbolName`, but names an image in Assets.xcassets
  /// (the actual Ojo brand icons — src/assets/images/weatherIcons/*.png) for
  /// the Home Screen widget, which can render full-color art. Lock Screen
  /// accessory families stay on `sfSymbolName`: those are vibrancy/tint
  /// composited by the system and can't show full-color custom images.
  static func iconAssetName(kind rawKind: String?, isDay: Bool?) -> String {
    let day = isDay ?? true
    switch WidgetWeatherKind(rawValue: rawKind ?? "") {
    case .thunderstorm:   return "Storm"
    case .snow, .ice:     return "Snow"
    case .drizzle, .rain: return "Rainy"
    case .hot, .sunny:    return "Sunny"
    case .fog, .cloudy:   return "Cloudy"
    case .haze:           return day ? "PartlyCloudy" : "PartlyCloudyNight"
    case .clear:          return day ? "Sunny" : "ClearNight"
    case .partlyCloudy:   return day ? "PartlyCloudy" : "PartlyCloudyNight"
    case .none:           return "Cloudy"
    }
  }
}
