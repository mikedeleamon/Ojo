/**
 * expo-target.config.js — @bacons/apple-targets descriptor for the Ojo widget.
 *
 * `expo prebuild` uses this to generate the WidgetKit app-extension target,
 * link WidgetKit/SwiftUI, and write the target's .entitlements. All *.swift
 * files in this directory are compiled into the extension.
 *
 * The App Group here MUST match the main app's entitlement
 * (plugins/withOjoAppGroup.js) so the widget can read snapshot.json + thumbs/
 * from the same shared container the JS bridge writes to.
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: 'widget',
  name: 'OjoWidget',
  deploymentTarget: '15.1',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.ojostudio.ojo'],
  },
};
