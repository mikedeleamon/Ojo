// Runtime fingerprint settings (expo-updates `runtimeVersion: { policy: 'fingerprint' }`).
//
// A build only receives OTA updates published with the same fingerprint, so
// anything hashed here that isn't native code can silently cut a store build
// off from updates when it's edited. Two such sources are skipped:
//   - .gitignore: un-ignoring package-lock.json or Podfile.lock is a repo change,
//     not a native one (EAS uploads by .easignore, which stays hashed).
//   - package.json scripts: adding an npm script changes nothing in the binary.
//     Native dependencies are hashed through their own directories regardless.
// Files to skip outright live in .fingerprintignore.
/** @type {import('expo/fingerprint').Config} */
const { SourceSkips } = require('expo/fingerprint');

module.exports = {
  sourceSkips:
    SourceSkips.PackageJsonAndroidAndIosScriptsIfNotContainRun | // Expo's default
    SourceSkips.PackageJsonScriptsAll |
    SourceSkips.GitIgnore,
};
