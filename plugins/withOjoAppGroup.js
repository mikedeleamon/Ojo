const { withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * withOjoAppGroup
 *
 * Adds the shared App Group entitlement to the MAIN iOS app target so the
 * React-Native side and the (future) WidgetKit extension can exchange the
 * widget snapshot JSON + cached thumbnails through a common container:
 *
 *     FileManager.containerURL(forSecurityApplicationGroupIdentifier:)
 *
 * The App Group id is intentionally duplicated in three places that must stay
 * in sync — keep them identical when changing it:
 *   - here (main-app entitlement)
 *   - modules/ojo-widget-bridge/ios/OjoWidgetBridgeModule.swift (native reads/writes)
 *   - src/lib/widget/native.ts (JS constant, documentation only)
 *
 * The widget extension target gets its own copy of this entitlement when that
 * target is created (Phase 2); this plugin only covers the main app, and is
 * safe to re-run — it de-dupes the group id.
 *
 * Config plugins are required because `expo prebuild` regenerates ios/, so the
 * entitlement cannot be hand-edited into the pbxproj/entitlements durably.
 */
const APP_GROUP = 'group.com.ojostudio.ojo';

const withOjoAppGroup = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    const key = 'com.apple.security.application-groups';
    const existing = Array.isArray(cfg.modResults[key]) ? cfg.modResults[key] : [];
    if (!existing.includes(APP_GROUP)) {
      cfg.modResults[key] = [...existing, APP_GROUP];
    }
    return cfg;
  });

module.exports = withOjoAppGroup;
