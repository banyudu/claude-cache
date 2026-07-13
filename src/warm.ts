/**
 * Cache-warm helpers.
 *
 * Warming is driven entirely from the SessionStart hook: the model arms a one-shot
 * CronCreate at session start, and re-arms via ScheduleWakeup on each fired ping.
 * There is NO Stop hook — so nothing is injected after each reply, and there is no
 * per-turn message. CronCreate is non-turn-terminating, so the initial arm can run
 * alongside the model's first reply without swallowing it (the property that used to
 * require a Stop hook back when arming used the turn-terminating ScheduleWakeup).
 */

/** User-message content that marks a fired idle cache-warm ping (a heartbeat, not a request). */
export const WARM_PING_SENTINEL = '__cache-warm-ping__';

/** `reason` passed to ScheduleWakeup so a cache-warm wakeup is identifiable. */
export const WARM_REASON = 'claude-cache: idle-timer refresh';

/** Case-insensitive substring gate: is `model` covered by any `excludeModels` entry? */
export function modelExcluded(model: string, excludeModels: string[]): boolean {
  if (!model) return false;
  const lower = model.toLowerCase();
  return excludeModels.some((m) => m && lower.includes(m.toLowerCase()));
}

/**
 * A 5-field local-time cron expression for a one-shot ~`seconds`-from-now wakeup.
 * Pins minute/hour/day/month to the target so that with `recurring: false` CronCreate
 * fires exactly once then auto-deletes. Weekday is left wildcard (day+month already
 * pin a unique calendar day).
 */
export function cronForDelay(seconds: number): string {
  const t = new Date(Date.now() + seconds * 1000);
  return [t.getMinutes(), t.getHours(), t.getDate(), t.getMonth() + 1, '*'].join(' ');
}
