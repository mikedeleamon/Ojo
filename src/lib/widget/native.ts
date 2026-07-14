/**
 * widget/native.ts — thin, typed access to the OjoWidgetBridge native module.
 *
 * Resolves the module by its native registration name via
 * `requireOptionalNativeModule`, so it works without JS package-name resolution
 * for the local `modules/ojo-widget-bridge` module (mirrors ojo-ui-style).
 *
 * Every export is a safe no-op when the bridge isn't linked — Android, Expo Go,
 * web, or a JS reload before a fresh prebuild — so call sites never need to
 * platform-guard.
 */

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Shared App Group id. Documentation/reference only on the JS side — the native
 * module holds the authoritative copy. MUST match:
 *   - plugins/withOjoAppGroup.js
 *   - modules/ojo-widget-bridge/ios/OjoWidgetBridgeModule.swift
 */
export const WIDGET_APP_GROUP = 'group.com.ojostudio.ojo';

interface OjoWidgetBridgeNative {
  /** Atomically write snapshot JSON to the App Group + reload WidgetKit
   *  timelines. Async — the write and reload run on a native background queue
   *  so they never stall the JS thread. */
  writeSnapshot(json: string): Promise<void>;
  /** Download + downscale one thumbnail; resolves to its container-relative path. */
  cacheThumb(remoteUrl: string): Promise<string>;
  /** Delete cached thumbnails whose relative paths aren't in keepPaths. */
  pruneThumbs(keepPaths: string[]): Promise<void>;
}

const Native =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<OjoWidgetBridgeNative>('OjoWidgetBridge')
    : null;

/** True only when the native bridge is linked (iOS dev-client / release build). */
export const isWidgetBridgeAvailable = (): boolean => Native != null;

export const writeSnapshot = async (json: string): Promise<void> => {
  await Native?.writeSnapshot(json);
};

/**
 * Cache one remote thumbnail into the shared container. Returns the
 * container-relative path (e.g. "thumbs/1a2b.jpg"), or null when the bridge is
 * absent, the url is empty, or the download/encode failed — callers treat null
 * as "show a placeholder".
 */
export const cacheThumb = async (remoteUrl: string): Promise<string | null> => {
  if (!Native || !remoteUrl) return null;
  try {
    return await Native.cacheThumb(remoteUrl);
  } catch (e) {
    console.warn('[Ojo] widget cacheThumb failed:', e);
    return null;
  }
};

/** Best-effort cleanup — never throws; a failed prune just leaves stale thumbs. */
export const pruneThumbs = async (keepPaths: string[]): Promise<void> => {
  try {
    await Native?.pruneThumbs(keepPaths);
  } catch (e) {
    console.warn('[Ojo] widget pruneThumbs failed:', e);
  }
};
