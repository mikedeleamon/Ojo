#!/usr/bin/env node
/**
 * Publish an over-the-air update with the same EXPO_PUBLIC_* values the store
 * build was made with.
 *
 *   npm run update -- <profile> "<message>" [--rollout <percent>] [--dry-run]
 *
 * Why not plain `eas update`: it bundles with whatever is in the local .env,
 * which points at dev services and holds the RevenueCat *test* key. An update
 * built that way would ship those values to every production user. So this
 * script:
 *
 *   1. Bundles with EXPO_NO_DOTENV=1, only the env block of the eas.json
 *      build profile (the values the binary itself was built with), and a
 *      cleared Metro cache.
 *   2. Checks the bundle: every profile value must be in it, and no local
 *      .env EXPO_PUBLIC_* value that differs from the profile may be.
 *   3. Publishes that exact bundle (`eas update --skip-bundler`) to the
 *      profile's channel, then uploads its source maps to Sentry.
 *
 * --dry-run stops after step 2.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const fail = (msg) => {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
};

const run = (cmd, args, env) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { cwd: ROOT, env, stdio: 'inherit' });
  if (res.status !== 0) fail(`${cmd} ${args[0]} exited with ${res.status}`);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const flags = { rollout: null, dryRun: false };
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') flags.dryRun = true;
    else if (args[i] === '--rollout') flags.rollout = args[++i];
    else positional.push(args[i]);
  }
  const [profile, message] = positional;
  if (!profile || !message) {
    fail('usage: npm run update -- <profile> "<message>" [--rollout <percent>] [--dry-run]');
  }
  if (flags.rollout !== null && !/^([1-9][0-9]?|100)$/.test(flags.rollout)) {
    fail('--rollout must be a whole number from 1 to 100');
  }
  return { profile, message, ...flags };
};

/** EXPO_PUBLIC_* entries of a dotenv file, or {} if it doesn't exist. */
const readDotenvPublic = (file) => {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*(EXPO_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
};

const bundleText = () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(hbc|js)$/.test(entry.name)) files.push(p);
    }
  };
  walk(path.join(DIST, '_expo'));
  if (files.length === 0) fail('no bundle found under dist/_expo');
  // latin1 keeps every byte, so plain-ASCII strings inside Hermes bytecode match.
  return files.map((f) => fs.readFileSync(f).toString('latin1')).join('\n');
};

const main = () => {
  const { profile, message, rollout, dryRun } = parseArgs();

  const eas = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
  const build = eas.build?.[profile];
  if (!build) fail(`eas.json has no build profile "${profile}"`);
  if (!build.channel) fail(`build profile "${profile}" has no channel`);
  const profileEnv = build.env ?? {};

  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('EXPO_PUBLIC_')) delete env[key];
  }
  Object.assign(env, profileEnv, { EXPO_NO_DOTENV: '1', NODE_ENV: 'production' });

  // --clear matters: Metro caches transformed files with EXPO_PUBLIC_* values
  // already inlined, so without it a dev session's values can survive into
  // this bundle even though the environment is right.
  fs.rmSync(DIST, { recursive: true, force: true });
  run('npx', ['expo', 'export', '--platform', 'ios', '--output-dir', 'dist', '--source-maps', '--clear'], env);

  const bundle = bundleText();
  const missing = Object.entries(profileEnv)
    .filter(([k, v]) => k.startsWith('EXPO_PUBLIC_') && !bundle.includes(v))
    .map(([k]) => k);
  // A profile value can legitimately be unused by code; only warn for those.
  if (missing.length) console.warn(`\n! profile values not found in the bundle: ${missing.join(', ')}`);

  const local = { ...readDotenvPublic(path.join(ROOT, '.env')), ...readDotenvPublic(path.join(ROOT, '.env.local')) };
  const leaked = Object.entries(local)
    .filter(([k, v]) => v && v !== profileEnv[k] && bundle.includes(v))
    .map(([k]) => k);
  if (leaked.length) fail(`local .env values leaked into the bundle: ${leaked.join(', ')}`);
  console.log(`\n✔ bundle uses the "${profile}" profile's values`);

  if (dryRun) {
    console.log('\nDry run: nothing published. The bundle is in dist/.');
    return;
  }

  const updateArgs = [
    'eas-cli', 'update',
    '--channel', build.channel,
    '--platform', 'ios',
    '--message', message,
    '--skip-bundler',
    '--input-dir', 'dist',
    '--non-interactive',
  ];
  if (rollout) updateArgs.push('--rollout-percentage', rollout);
  run('npx', updateArgs, env);

  // Reads SENTRY_ORG/PROJECT/URL from the profile env and SENTRY_AUTH_TOKEN
  // from .env or .env.local, which it loads through @expo/env. That loader
  // honours EXPO_NO_DOTENV, so drop it here: the bundle is already built, and
  // with it set the token never loads.
  const sentryEnv = { ...env };
  delete sentryEnv.EXPO_NO_DOTENV;
  run('npx', ['sentry-expo-upload-sourcemaps', 'dist'], sentryEnv);
};

main();
