/**
 * The Add tab is a placeholder that opens the camera whenever it gains focus, so
 * closing the camera can land back on that tab and open it again. CameraPage
 * flags the return here, and the placeholder hands off to Home instead.
 *
 * The flag expires because that re-focus doesn't always happen: closing often
 * lands on Home directly. A flag left set would then send the user's next tap on
 * Add to Home instead of the camera.
 */
const RETURN_WINDOW_MS = 1500;

let markedAt: number | null = null;

export const markCameraReturning = () => {
  markedAt = Date.now();
};

export const consumeCameraReturning = (): boolean => {
  const fresh = markedAt !== null && Date.now() - markedAt < RETURN_WINDOW_MS;
  markedAt = null;
  return fresh;
};
