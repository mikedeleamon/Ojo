import { consumeCameraReturning, markCameraReturning } from '../cameraTabReturn';

describe('cameraTabReturn', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    consumeCameraReturning();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is false when nothing was marked', () => {
    expect(consumeCameraReturning()).toBe(false);
  });

  it('is true for a re-focus right after closing the camera', () => {
    markCameraReturning();
    jest.advanceTimersByTime(200);
    expect(consumeCameraReturning()).toBe(true);
  });

  it('only answers true once', () => {
    markCameraReturning();
    expect(consumeCameraReturning()).toBe(true);
    expect(consumeCameraReturning()).toBe(false);
  });

  it('expires, so a later tap on Add opens the camera', () => {
    markCameraReturning();
    jest.advanceTimersByTime(5000);
    expect(consumeCameraReturning()).toBe(false);
  });
});
