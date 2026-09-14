/**
 * Once-per-session guards for the notification reconcilers.
 *
 * Several reconcilers (weekly recap, morning brief, same-day nudge, trip plans)
 * are triggered from effects that re-run far more often than the work needs to
 * happen — AuthGate's effect fires on every segment change, useTripPlans mounts
 * on several screens. Each used to carry its own module-level
 * `…ReconciledThisLaunch` boolean.
 *
 * Two things went wrong with that:
 *
 *  - "launch" was the wrong scope. Every reconciler's answer is account- or
 *    pref-specific, and both can change without the process restarting. A flag
 *    latched for the whole process meant signing into a second account left all
 *    of them unreconciled until a cold start — and, now that sign-out cancels
 *    the previous account's scheduled notifications, would have left the new
 *    account with none at all.
 *  - The flags were unreachable from the places that invalidate them, so
 *    nothing could clear one. Turning the Trip Mode nudge back on mid-session
 *    left it unscheduled until the app was force-quit.
 *
 * Holding them together here gives both invalidation points — an account change
 * and a pref change — something to call.
 */

export type ReconcileTask =
  | 'weeklyRecap'
  | 'morningBrief'
  | 'sameDayNudge'
  | 'tripPlans';

const done: Record<ReconcileTask, boolean> = {
  weeklyRecap:  false,
  morningBrief: false,
  sameDayNudge: false,
  tripPlans:    false,
};

/**
 * True the first time it's called for `task` this session, false afterwards —
 * so the caller runs the work exactly once. Claiming is synchronous and happens
 * before the async work starts, so two callers racing can't both win.
 */
export const claimReconcile = (task: ReconcileTask): boolean => {
  if (done[task]) return false;
  done[task] = true;
  return true;
};

/** Let `task` run again — for when the pref behind it changes mid-session. */
export const releaseReconcile = (task: ReconcileTask): void => {
  done[task] = false;
};

/** Sign-out or account switch: every reconciler's answer is now stale. */
export const resetLaunchReconcilers = (): void => {
  (Object.keys(done) as ReconcileTask[]).forEach((task) => {
    done[task] = false;
  });
};
