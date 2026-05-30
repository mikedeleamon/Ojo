import ExpoModulesCore
import UIKit

/**
 * OjoUIStyleModule
 *
 * Exposes UIWindow.overrideUserInterfaceStyle to JavaScript so the app's
 * in-app theme toggle can drive every native surface iOS renders for our
 * window — alerts, share sheets, action sheets, the status bar, and iOS 26
 * glass materials (including GlassContainer's merged backdrop) — instead of
 * having those surfaces follow the system appearance independently.
 *
 * Call `setOverrideUserInterfaceStyle('dark' | 'light' | 'auto')` from JS.
 *  - 'dark'  → all windows render as if the system is dark
 *  - 'light' → all windows render as if the system is light
 *  - 'auto'  → restores .unspecified, meaning windows follow the OS again
 *
 * Applied to every window of every active UIWindowScene so that modally
 * presented content (e.g. share sheet, image picker, our /camera modal)
 * also inherits the override.
 */
public class OjoUIStyleModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OjoUIStyle")

    Function("setOverrideUserInterfaceStyle") { (scheme: String) -> Void in
      DispatchQueue.main.async {
        let style: UIUserInterfaceStyle
        switch scheme {
        case "dark":  style = .dark
        case "light": style = .light
        default:      style = .unspecified
        }

        for scene in UIApplication.shared.connectedScenes {
          guard let windowScene = scene as? UIWindowScene else { continue }
          for window in windowScene.windows {
            window.overrideUserInterfaceStyle = style
          }
        }
      }
    }
  }
}
