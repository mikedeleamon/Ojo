// Keeps two OjoWidget settings that @bacons/apple-targets doesn't manage, so a
// clean `expo prebuild` can't lose them:
//   - a build phase that copies the app's CFBundleVersion into the widget. EAS
//     auto-increments only the app's number, and App Store validation rejects an
//     extension whose number differs from its parent.
//   - TARGETED_DEVICE_FAMILY = 1, matching the iPhone-only app.
//
// This must be listed BEFORE "@bacons/apple-targets" in app.json. Mods run in
// reverse order, so that's what makes this run after the target exists.
const { PBXShellScriptBuildPhase } = require('@bacons/xcode');
const { withXcodeProjectBeta } = require('@bacons/apple-targets/build/with-bacons-xcode');

const TARGET_NAME = 'OjoWidget';
const PHASE_NAME = 'Sync CFBundleVersion with host app';
const SHELL_SCRIPT = [
  'HOST_VERSION=$(/usr/libexec/PlistBuddy -c "Print CFBundleVersion" "${SRCROOT}/Ojo/Info.plist")',
  'WIDGET_PLIST="${TARGET_BUILD_DIR}/${INFOPLIST_PATH}"',
  '/usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${HOST_VERSION}" "${WIDGET_PLIST}" || /usr/libexec/PlistBuddy -c "Add :CFBundleVersion string ${HOST_VERSION}" "${WIDGET_PLIST}"',
  '',
].join('\n');

module.exports = function withWidgetBuildSettings(config) {
  return withXcodeProjectBeta(config, (config) => {
    const target = config.modResults.rootObject.props.targets.find((t) => t.props.name === TARGET_NAME);
    if (!target) throw new Error(`withWidgetBuildSettings: no ${TARGET_NAME} target. Check the plugin order in app.json.`);

    target.props.buildConfigurationList.props.buildConfigurations.forEach((c) => {
      c.props.buildSettings.TARGETED_DEVICE_FAMILY = '1';
    });

    const exists = target.props.buildPhases.some((p) => p.props.name === PHASE_NAME);
    if (!exists) {
      target.createBuildPhase(PBXShellScriptBuildPhase, {
        name: PHASE_NAME,
        alwaysOutOfDate: 1,
        shellPath: '/bin/sh',
        shellScript: SHELL_SCRIPT,
      });
    }
    return config;
  });
};
