import CameraPage from '../src/views/CameraPage/CameraPage';

// Top-level fullScreenModal route — sits *above* the (tabs) stack so the
// native tab bar is hidden whenever the camera is presented. See app/_layout.tsx
// for the presentation options.
//
// NOTE: this route is intentionally named `capture` (URL /capture), NOT `camera`.
// A route group like (tabs) is pathless, so app/(tabs)/camera.tsx already owns the
// URL /camera. Naming this file camera.tsx too made both resolve to /camera, and
// router.push('/camera') silently landed on the in-tabs placeholder instead of
// presenting this modal — a blank screen with the tab bar still visible.
export default function CameraScreen() {
  return <CameraPage />;
}
