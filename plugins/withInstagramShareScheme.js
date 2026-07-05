const { withInfoPlist } = require('@expo/config-plugins');

/**
 * withInstagramShareScheme
 *
 * Registers Instagram's custom URL scheme in LSApplicationQueriesSchemes so
 * `Linking.canOpenURL('instagram-stories://share')` (used by react-native-share
 * and src/lib/share/instagramShare.ts to detect whether Instagram is installed)
 * resolves correctly. Without this entry iOS silently reports the app as "not
 * installed" even when it is, per Apple's query-schemes allowlist.
 *
 * Config plugins are required because `expo prebuild` regenerates ios/, so
 * this can't be hand-edited into Info.plist durably (same reasoning as
 * withOjoAppGroup.js).
 */
const SCHEMES = ['instagram-stories', 'instagram'];

const withInstagramShareScheme = (config) =>
  withInfoPlist(config, (cfg) => {
    const key = 'LSApplicationQueriesSchemes';
    const existing = Array.isArray(cfg.modResults[key]) ? cfg.modResults[key] : [];
    const merged = [...existing];
    for (const scheme of SCHEMES) {
      if (!merged.includes(scheme)) merged.push(scheme);
    }
    cfg.modResults[key] = merged;
    return cfg;
  });

module.exports = withInstagramShareScheme;
