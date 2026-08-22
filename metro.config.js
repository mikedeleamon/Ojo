const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Allow Metro to bundle .tflite model files as binary assets
config.resolver.assetExts.push('tflite');

module.exports = config;
