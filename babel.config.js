module.exports = function(api) {
  // Keyed on NODE_ENV rather than api.cache(true): the plugin list below is
  // env-dependent, and an unconditional cache would freeze whichever config was
  // computed first and reuse it for release bundles too.
  api.cache.using(() => process.env.NODE_ENV);

  // Hermes does not strip console calls, so anything left in the bundle runs on
  // device. The cost is not hypothetical — src/services/clothingIdentifier.ts
  // logs several times per image on the closet-add path (base64 lengths, decoded
  // byte counts, pixel counts), and src/services/colorExtractor.ts adds more.
  //
  // error/warn are kept: they are rare, they are what a developer actually reads
  // in a TestFlight device log, and ErrorBoundary uses console.error as its
  // last-resort record alongside the Sentry report.
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ...(isProduction
        ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
        : []),
      'react-native-reanimated/plugin', // must be last
    ],
  };
};
