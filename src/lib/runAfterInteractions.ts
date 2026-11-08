/**
 * Runs `task` once the JS thread is idle, capped at `timeoutMs` so a busy thread
 * can't postpone it forever.
 *
 * React Native 0.88 removed InteractionManager and points to requestIdleCallback.
 * Call sites keep the same `{ cancel }` shape they had with
 * `InteractionManager.runAfterInteractions`.
 */
export function runAfterInteractions(
  task: () => void | Promise<void>,
  timeoutMs = 500,
): { cancel: () => void } {
  const id = requestIdleCallback(() => {
    void task();
  }, { timeout: timeoutMs });
  return { cancel: () => cancelIdleCallback(id) };
}
