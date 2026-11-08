// Keeps the dev launcher's local-network keys out of Info.plist. expo-dev-launcher
// adds them to every configuration and relies on a build phase to strip them from
// Release, but that phase runs before Xcode writes the app's Info.plist, so it
// finds nothing and a "Expo Dev Launcher" permission string would reach the App
// Store. Dev builds don't need them: Metro's URL can be opened directly, and iOS
// falls back to its standard prompt for the local network.
const { withInfoPlist } = require('expo/config-plugins');

module.exports = function withoutDevLauncherNetworkKeys(config) {
  return withInfoPlist(config, (config) => {
    delete config.modResults.NSBonjourServices;
    delete config.modResults.NSLocalNetworkUsageDescription;
    return config;
  });
};
