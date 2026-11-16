// Keeps UIBackgroundModes to "processing" alone. expo-task-manager's plugin (pulled in by
// expo-background-task and expo-location) always adds "fetch", but nothing in Ojo uses
// background fetch: expo-background-task schedules a BGProcessingTaskRequest, which needs only
// "processing", and the geofence wakes need no background mode. An unused mode is something App
// Review can ask about, so 1.2.0 ships without it.
//
// This must be listed BEFORE the plugins that add "fetch" in app.json. Mods run in reverse
// order, so that's what makes this run after them.
const { withInfoPlist } = require('expo/config-plugins');

module.exports = function withoutBackgroundFetchMode(config) {
  return withInfoPlist(config, (config) => {
    const modes = config.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) {
      const kept = modes.filter((m) => m !== 'fetch');
      if (kept.length) config.modResults.UIBackgroundModes = kept;
      else delete config.modResults.UIBackgroundModes;
    }
    return config;
  });
};
