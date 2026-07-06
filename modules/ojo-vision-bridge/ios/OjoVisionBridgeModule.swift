import ExpoModulesCore
import UIKit
import Vision

/**
 * OjoVisionBridgeModule
 *
 * Segments the primary foreground subject out of a garment photo using
 * iOS Vision (VNGenerateForegroundInstanceMaskRequest, iOS 17+) and returns a
 * transparent-background PNG cutout. It never touches color logic itself —
 * colorExtractor.ts decides what to do with the cutout it gets back.
 *
 * JS API (see src/lib/vision/native.ts):
 *   - segmentGarment(uri) → file:// URI of an RGBA PNG cutout, or null when
 *     the OS is below iOS 17, no confident subject was found, or the bridge
 *     isn't linked. Callers treat null as "fall back to the existing crop
 *     heuristic" — this is never a hard failure case.
 */

public class OjoVisionBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OjoVisionBridge")

    // ── segmentGarment ───────────────────────────────────────────────────────
    AsyncFunction("segmentGarment") { (uri: String, promise: Promise) in
      do {
        guard let resultURI = try segmentForegroundSubject(uri: uri) else {
          promise.resolve(nil)
          return
        }
        promise.resolve(resultURI)
      } catch {
        promise.reject("SegmentationFailed", error.localizedDescription)
      }
    }
  }
}

// ── Segmentation ─────────────────────────────────────────────────────────────

/// Returns the file:// URI of a masked PNG cutout, or nil when there's no
/// confident subject to isolate — the caller treats that as "use today's
/// heuristic," not an error.
private func segmentForegroundSubject(uri: String) throws -> String? {
  guard #available(iOS 17.0, *) else {
    NSLog("[Ojo][vision] iOS < 17 — foreground segmentation unavailable, returning nil")
    return nil
  }

  guard let image = loadUIImage(from: uri), let cgImage = image.cgImage else {
    throw ojoError("LoadFailed", "Could not load image at \(uri)")
  }

  let handler = VNImageRequestHandler(
    cgImage: cgImage,
    orientation: cgOrientation(from: image.imageOrientation),
    options: [:]
  )
  let request = VNGenerateForegroundInstanceMaskRequest()
  try handler.perform([request])

  guard let observation = request.results?.first else {
    NSLog("[Ojo][vision] no foreground subject found in image")
    return nil
  }

  // allInstances includes the background at index 0 — exclude it so we mask
  // in just the detected subject(s), not the whole frame.
  let foregroundInstances = observation.allInstances.subtracting([0])
  guard !foregroundInstances.isEmpty else {
    NSLog("[Ojo][vision] observation had only background, no subject instances")
    return nil
  }

  let maskedBuffer = try observation.generateMaskedImage(
    ofInstances: foregroundInstances,
    from: handler,
    croppedToInstancesExtent: true
  )

  guard let url = try writeMaskedPNG(maskedBuffer) else {
    throw ojoError("EncodeFailed", "Could not encode segmented cutout.")
  }
  NSLog("[Ojo][vision] segmented \(foregroundInstances.count) instance(s) → \(url.lastPathComponent)")
  return url.absoluteString
}

private func writeMaskedPNG(_ pixelBuffer: CVPixelBuffer) throws -> URL? {
  let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
  guard let cgImage = CIContext().createCGImage(ciImage, from: ciImage.extent) else { return nil }
  guard let pngData = UIImage(cgImage: cgImage).pngData() else { return nil }

  let url = FileManager.default.temporaryDirectory
    .appendingPathComponent("\(UUID().uuidString).png")
  try pngData.write(to: url, options: .atomic)
  return url
}

// ── Helpers ──────────────────────────────────────────────────────────────────

private func loadUIImage(from uriString: String) -> UIImage? {
  guard let url = URL(string: uriString), url.isFileURL else {
    return UIImage(contentsOfFile: uriString)
  }
  return UIImage(contentsOfFile: url.path)
}

private func cgOrientation(from uiOrientation: UIImage.Orientation) -> CGImagePropertyOrientation {
  switch uiOrientation {
  case .up:            return .up
  case .upMirrored:    return .upMirrored
  case .down:          return .down
  case .downMirrored:  return .downMirrored
  case .left:          return .left
  case .leftMirrored:  return .leftMirrored
  case .right:         return .right
  case .rightMirrored: return .rightMirrored
  @unknown default:    return .up
  }
}

private func ojoError(_ code: String, _ message: String) -> NSError {
  NSError(domain: "OjoVisionBridge", code: code.hashValue,
          userInfo: [NSLocalizedDescriptionKey: message, "code": code])
}
