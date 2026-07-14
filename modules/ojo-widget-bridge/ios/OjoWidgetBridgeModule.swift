import ExpoModulesCore
import UIKit
import WidgetKit

/**
 * OjoWidgetBridgeModule
 *
 * Bridges the React-Native side to the shared App Group container that the
 * WidgetKit extension reads from. It never renders anything itself — it only
 * writes the snapshot contract + cached thumbnails and asks WidgetKit to reload.
 *
 * JS API (see src/lib/widget/native.ts):
 *   - writeSnapshot(json)        → writes snapshot.json, reloads all timelines
 *   - cacheThumb(remoteUrl)      → downloads + downscales one thumbnail, returns
 *                                  its container-relative path ("thumbs/<hash>.jpg")
 *   - pruneThumbs(keepPaths)     → deletes cached thumbnails not in keepPaths
 *
 * The App Group id MUST match plugins/withOjoAppGroup.js and the widget target.
 */

private let APP_GROUP = "group.com.ojostudio.ojo"
private let SNAPSHOT_FILE = "snapshot.json"
private let THUMBS_DIR = "thumbs"
private let THUMB_MAX_DIM: CGFloat = 256

public class OjoWidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OjoWidgetBridge")

    // ── writeSnapshot ────────────────────────────────────────────────────────
    // Atomically write the widget snapshot JSON into the App Group container and
    // reload WidgetKit timelines. Throws (→ JS rejection) if the container is
    // unavailable, which almost always means the App Group entitlement is missing.
    // AsyncFunction so the file write + timeline reload run on a background
    // queue — as a sync Function they executed on the JS thread, and every
    // snapshot write froze button taps and navigation for the duration.
    AsyncFunction("writeSnapshot") { (json: String) throws -> Void in
      let container = try appGroupContainer()
      let fileURL = container.appendingPathComponent(SNAPSHOT_FILE)
      guard let data = json.data(using: .utf8) else {
        throw ojoError("EncodingFailed", "Snapshot JSON was not valid UTF-8.")
      }
      try data.write(to: fileURL, options: .atomic)
      WidgetCenter.shared.reloadAllTimelines()
    }

    // ── cacheThumb ───────────────────────────────────────────────────────────
    // Download `remoteUrl`, downscale to a widget-friendly JPEG, and cache it in
    // the App Group under thumbs/<hash>.jpg. Returns the container-relative path.
    // The filename is a stable hash of the URL, so a changed image URL yields a
    // new file (and identical URLs dedupe). Skips the network entirely when the
    // file already exists.
    AsyncFunction("cacheThumb") { (remoteUrl: String, promise: Promise) in
      let container: URL
      do {
        container = try appGroupContainer()
      } catch {
        promise.reject("AppGroupUnavailable", error.localizedDescription)
        return
      }

      let thumbsDir = container.appendingPathComponent(THUMBS_DIR, isDirectory: true)
      let name = "\(stableHash(remoteUrl)).jpg"
      let relPath = "\(THUMBS_DIR)/\(name)"
      let destURL = thumbsDir.appendingPathComponent(name)

      // Already cached → return immediately, no network.
      if FileManager.default.fileExists(atPath: destURL.path) {
        promise.resolve(relPath)
        return
      }
      guard let url = URL(string: remoteUrl) else {
        promise.reject("BadURL", "Invalid image URL: \(remoteUrl)")
        return
      }

      let task = URLSession.shared.dataTask(with: url) { data, response, error in
        if let error = error {
          promise.reject("DownloadFailed", error.localizedDescription)
          return
        }
        // Surface non-2xx responses (e.g. R2 rate-limiting/404) distinctly from a
        // genuinely corrupt image — both land in UIImage(data:) as a decode
        // failure otherwise, which hides the real cause.
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
          promise.reject("HTTPError", "HTTP \(http.statusCode) fetching \(remoteUrl)")
          return
        }
        guard let data = data, let image = UIImage(data: data) else {
          promise.reject("DecodeFailed", "Could not decode image at \(remoteUrl)")
          return
        }
        guard let jpeg = downscaledJPEG(image, maxDim: THUMB_MAX_DIM) else {
          promise.reject("EncodeFailed", "Could not encode thumbnail.")
          return
        }
        do {
          try FileManager.default.createDirectory(
            at: thumbsDir, withIntermediateDirectories: true)
          try jpeg.write(to: destURL, options: .atomic)
          promise.resolve(relPath)
        } catch {
          promise.reject("WriteFailed", error.localizedDescription)
        }
      }
      task.resume()
    }

    // ── pruneThumbs ──────────────────────────────────────────────────────────
    // Best-effort cleanup: remove any cached thumbnail whose relative path isn't
    // in `keepPaths`, so the container doesn't grow unbounded as the closet
    // changes. Silent no-op if the container is unavailable. AsyncFunction for
    // the same reason as writeSnapshot — directory enumeration + deletes must
    // not run on the JS thread.
    AsyncFunction("pruneThumbs") { (keepPaths: [String]) -> Void in
      guard let container = try? appGroupContainer() else { return }
      let thumbsDir = container.appendingPathComponent(THUMBS_DIR, isDirectory: true)
      let keep = Set(keepPaths.map { ($0 as NSString).lastPathComponent })
      let fm = FileManager.default
      guard let files = try? fm.contentsOfDirectory(atPath: thumbsDir.path) else { return }
      for file in files where !keep.contains(file) {
        try? fm.removeItem(at: thumbsDir.appendingPathComponent(file))
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

private func appGroupContainer() throws -> URL {
  guard let url = FileManager.default
    .containerURL(forSecurityApplicationGroupIdentifier: APP_GROUP) else {
    throw ojoError(
      "AppGroupUnavailable",
      "App Group \(APP_GROUP) is not available. Check the app's entitlements.")
  }
  return url
}

private func ojoError(_ code: String, _ message: String) -> NSError {
  NSError(domain: "OjoWidgetBridge", code: code.hashValue,
          userInfo: [NSLocalizedDescriptionKey: message, "code": code])
}

/// djb2 — small, deterministic, and stable across launches (unlike Swift's
/// per-process-seeded `Hasher`). Used to name cached thumbnails by source URL.
private func stableHash(_ s: String) -> String {
  var hash: UInt64 = 5381
  for byte in s.utf8 {
    hash = (hash &* 33) &+ UInt64(byte)
  }
  return String(hash, radix: 16)
}

/// Redraw `image` so its longest edge is at most `maxDim` px, then JPEG-encode.
/// Never upscales.
private func downscaledJPEG(_ image: UIImage, maxDim: CGFloat) -> Data? {
  let w = image.size.width, h = image.size.height
  guard w > 0, h > 0 else { return nil }
  let scale = min(1, maxDim / max(w, h))
  let target = CGSize(width: w * scale, height: h * scale)
  let renderer = UIGraphicsImageRenderer(size: target)
  let scaled = renderer.image { _ in
    image.draw(in: CGRect(origin: .zero, size: target))
  }
  return scaled.jpegData(compressionQuality: 0.85)
}
