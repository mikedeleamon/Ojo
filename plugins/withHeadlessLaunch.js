// Writes 1.2.0's background-launch code into AppDelegate.swift and SceneDelegate.swift, so a
// clean `expo prebuild` can't drop it. Background refresh (src/lib/background) depends on it:
// when iOS launches Ojo with no window scene (a BGTaskScheduler wake), `HeadlessLaunch` starts
// React Native without a window so the JS task handlers still run.
//
//   - AppDelegate.swift: imports EXUpdates and ExpoModulesCore, calls
//     `HeadlessLaunch.prepare(factory:)` after `super.application(_:didFinishLaunchingWithOptions:)`,
//     and appends headless-launch/AppDelegate+HeadlessLaunch.swift (the `HeadlessLaunch` enum).
//     That file is text appended to AppDelegate.swift, not a separate source file: edit the code
//     there, then run prebuild.
//   - SceneDelegate.swift: overrides `scene(_:willConnectTo:options:)` to set
//     `HeadlessLaunch.sceneConnected`, so the window takes over startup once a scene connects.
//
// Every edit looks for exact template text and throws if it's missing, so an Expo template
// change fails prebuild loudly instead of producing an app without background launches.
const fs = require('fs');
const path = require('path');
const { withAppDelegate, withDangerousMod } = require('expo/config-plugins');

const HEADLESS_SOURCE = path.join(__dirname, 'headless-launch', 'AppDelegate+HeadlessLaunch.swift');
const MARKER = '// MARK: - Background launches';

const EXPO_IMPORT = 'internal import Expo\n';
const EXTRA_IMPORTS = 'internal import EXUpdates\ninternal import ExpoModulesCore\n';

const SUPER_LAUNCH = '    return super.application(application, didFinishLaunchingWithOptions: launchOptions)\n';
const SUPER_LAUNCH_WITH_HEADLESS = [
  '    let launched = super.application(application, didFinishLaunchingWithOptions: launchOptions)',
  '    // ...or, for a background launch that never gets a scene, `HeadlessLaunch` does.',
  '    HeadlessLaunch.prepare(factory: factory)',
  '    return launched',
  '',
].join('\n');

const SCENE_EXTENSION_POINT = '  // Extension point for config plugins.\n';
const SCENE_OVERRIDE = `
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
`;

function replaceOnce(contents, find, replacement, file) {
  const at = contents.indexOf(find);
  if (at === -1 || contents.indexOf(find, at + 1) !== -1) {
    throw new Error(
      `withHeadlessLaunch: expected exactly one ${JSON.stringify(find.trim())} in ${file}. ` +
        'The Expo template changed; update plugins/withHeadlessLaunch.js.',
    );
  }
  return contents.slice(0, at) + replacement + contents.slice(at + find.length);
}

function patchAppDelegate(contents) {
  if (contents.includes(MARKER)) return contents;
  let out = replaceOnce(contents, EXPO_IMPORT, EXPO_IMPORT + EXTRA_IMPORTS, 'AppDelegate.swift');
  out = replaceOnce(out, SUPER_LAUNCH, SUPER_LAUNCH_WITH_HEADLESS, 'AppDelegate.swift');
  if (!out.endsWith('\n')) out += '\n';
  return out + '\n' + fs.readFileSync(HEADLESS_SOURCE, 'utf8');
}

function patchSceneDelegate(contents) {
  if (contents.includes('HeadlessLaunch.sceneConnected')) return contents;
  return replaceOnce(contents, SCENE_EXTENSION_POINT, SCENE_EXTENSION_POINT + SCENE_OVERRIDE, 'SceneDelegate.swift');
}

const withHeadlessAppDelegate = (config) =>
  withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error('withHeadlessLaunch: AppDelegate is not Swift.');
    }
    config.modResults.contents = patchAppDelegate(config.modResults.contents);
    return config;
  });

// Expo has no SceneDelegate mod, so this edits the file directly.
const withHeadlessSceneDelegate = (config) =>
  withDangerousMod(config, [
    'ios',
    (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, config.modRequest.projectName, 'SceneDelegate.swift');
      const contents = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, patchSceneDelegate(contents));
      return config;
    },
  ]);

module.exports = function withHeadlessLaunch(config) {
  return withHeadlessSceneDelegate(withHeadlessAppDelegate(config));
};
