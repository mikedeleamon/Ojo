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
 * Deployment target is 16.0 (higher than the main app's 15.1) because the Lock
 * Screen accessory families (.accessoryRectangular / .accessoryInline) and
 * widgetAccentable() require iOS 16+. This only affects this extension target
 * — it simply won't offer those families on devices below 16, the host app is
 * unaffected.
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: 'widget',
  name: 'OjoWidget',
  deploymentTarget: '16.0',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.ojostudio.ojo'],
  },
};
