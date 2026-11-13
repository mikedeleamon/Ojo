internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.

  override func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    // From here the window owns React Native startup. If a background launch already started it
    // (HeadlessLaunch in AppDelegate.swift), super creates the window's surface on that host.
    HeadlessLaunch.sceneConnected = true
    super.scene(scene, willConnectTo: session, options: connectionOptions)
  }
}
