internal import Expo
internal import EXUpdates
internal import ExpoModulesCore
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // The window is created and React Native is started by `SceneDelegate` under the
    // scene-based life cycle (required by the iOS 27 SDK).
    let launched = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    // ...or, for a background launch that never gets a scene, `HeadlessLaunch` does.
    HeadlessLaunch.prepare(factory: factory)
    return launched
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

// MARK: - Background launches

/// Starts React Native without a window when iOS launches Ojo in the background and attaches no
/// window scene.
///
/// Under the scene life cycle, React Native is started by `ExpoAppSceneDelegate` when a window
/// scene connects. A geofence relaunch does get a scene, in the background state (verified on the
/// iOS 27.1 simulator, 2026-11-12: the region exit relaunched a closed Ojo, React Native started
/// through the scene, and the widget and device location updated). Launches that come with no
/// scene, such as BGTaskScheduler's, would otherwise never run the JS handlers in
/// src/lib/background/tasks.ts unless Ojo was still in memory. This is the fallback for those.
///
/// It starts the same React host the window would have created, on the same bundle (the one
/// expo-updates launches), with no surface. If the user then opens Ojo, `RCTRootViewFactory`
/// finds the existing `reactHost` and creates the window's surface on it, so there is only ever
/// one JS runtime. Launch deep links still arrive: expo-router reads them from expo-linking's
/// process-wide registry, which `ExpoAppSceneDelegate` fills when the window connects, not from
/// the host's launch options.
///
/// Release builds only. Debug builds start JS through expo-dev-client, whose launcher owns
/// startup, so background work there needs the app open.
@MainActor
enum HeadlessLaunch {
  /// Set by `SceneDelegate` when a window scene connects. From then on the window owns startup.
  static var sceneConnected = false

  private static weak var factory: ExpoReactNativeFactory?
  /// The controller's delegate is weak; this keeps ours alive until it is called.
  private static var updatesDelegate: UpdatesStartDelegate?

  static func prepare(factory: ExpoReactNativeFactory) {
#if !DEBUG
    self.factory = factory
    // Every launch that is going to get a scene gets it within the launch sequence: a foreground
    // launch, and (as tested) a geofence relaunch, whose scene connects in the background. So a
    // launch still windowless and in the background a second later is one iOS won't give a
    // window. Waiting rather than starting at once for a location launch keeps the common case
    // on React Native's ordinary path; the wait comes out of the ten-odd seconds a location
    // wake allows, and the JS asks for more as soon as it runs (withBackgroundTime).
    DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
      MainActor.assumeIsolated {
        guard !sceneConnected,
          UIApplication.shared.connectedScenes.isEmpty,
          UIApplication.shared.applicationState == .background
        else { return }
        start()
      }
    }
#endif
  }

  private static func start() {
    guard !sceneConnected, let factory, !hasHost(factory) else { return }
    NSLog("[Ojo] Background launch: starting React Native without a window")

    AppController.initializeWithoutStarting()
    let controller = AppController.sharedInstance
    guard controller.isActiveController else {
      // expo-updates is off, so the window would load the embedded bundle; so does this.
      startHost(bundleURL: nil)
      return
    }
    if controller.isStarted {
      // Nothing but a window starts it otherwise, and that window then owns startup.
      if let url = controller.launchAssetUrl() { startHost(bundleURL: url) }
      return
    }
    let delegate = UpdatesStartDelegate()
    updatesDelegate = delegate
    controller.delegate = delegate
    controller.start()
  }

  fileprivate static func updatesDidStart(_ controller: AppControllerInterface, success: Bool) {
    updatesDelegate = nil

    // A window may have connected while expo-updates was starting. Its handler then shows a
    // placeholder and waits for this callback: it only makes itself the controller's delegate
    // when it is the one starting the controller. So hand the callback on, but only when that
    // placeholder is really up. The handler takes a direct path instead when startup had already
    // finished, and calling it then trips its "reactDelegate should not be nil" fatalError.
    if isWindowWaitingOnUpdates() {
      for handler in ExpoAppDelegateSubscriberRepository.reactDelegateHandlers {
        (handler as? AppControllerDelegate)?.appController(controller, didStartWithSuccess: success)
      }
      return
    }
    guard !sceneConnected, success, let url = controller.launchAssetUrl() else { return }
    startHost(bundleURL: url)
  }

  /// `RCTRootViewFactory.reactHost` is declared against a forward-declared `RCTHost`, which
  /// Swift doesn't import, so it is read through key-value coding.
  private static func hasHost(_ factory: ExpoReactNativeFactory) -> Bool {
    factory.rootViewFactory.value(forKey: "reactHost") != nil
  }

  private static func isWindowWaitingOnUpdates() -> Bool {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .contains { $0.rootViewController?.view is EXDeferredRCTRootView }
  }

  /// The first half of `ExpoReactNativeFactory.recreateRootView`, without the view: point the
  /// factory's configuration at the bundle, then create the host (which loads and runs it).
  private static func startHost(bundleURL: URL?) {
    guard let factory else { return }
    guard !hasHost(factory) else { return }
    let viewFactory = factory.rootViewFactory

    let configuration = viewFactory.value(forKey: "_configuration") as? RCTRootViewFactoryConfiguration
    if let bundleURL {
      configuration?.bundleURLBlock = { bundleURL }
    }
    viewFactory.initializeReactHost(
      launchOptions: nil,
      bundleConfiguration: ExpoBundleConfiguration.configuration(
        bundleURL: bundleURL ?? configuration?.bundleURLBlock()
      ),
      devMenuConfiguration: factory.devMenuConfiguration ?? RCTDevMenuConfiguration.default()
    )
  }
}

private final class UpdatesStartDelegate: NSObject, AppControllerDelegate {
  func appController(_ appController: AppControllerInterface, didStartWithSuccess success: Bool) {
    // expo-updates calls this on the main queue.
    MainActor.assumeIsolated {
      HeadlessLaunch.updatesDidStart(appController, success: success)
    }
  }
}
