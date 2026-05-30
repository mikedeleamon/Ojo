import CameraPage from '../src/views/CameraPage/CameraPage';

// Top-level fullScreenModal route — sits *above* the (tabs) stack so the
// native tab bar is hidden whenever the camera is presented. See app/_layout.tsx
// for the presentation options.
export default function CameraScreen() {
  return <CameraPage />;
}
