import * as fs from 'node:fs';

/** User-message content that marks a fired idle cache-warm ping (a heartbeat, not a request). */
export const WARM_PING_SENTINEL = '__cache-warm-ping__';

/** `reason` passed to ScheduleWakeup so a pending cache-warm wakeup is identifiable. */
export const WARM_REASON = 'claude-cache: idle-timer refresh';

/** Consecutive idle pings that fit inside the idle budget before we stop re-arming. */
export function maxConsecutivePings(intervalSeconds: number, maxIdleHours: number): number {
  return Math.max(1, Math.floor((maxIdleHours * 3600) / intervalSeconds));
}

/** Case-insensitive substring gate: is `model` covered by any `excludeModels` entry? */
export function modelExcluded(model: string, excludeModels: string[]): boolean {
  if (!model) return false;
  const lower = model.toLowerCase();
  return excludeModels.some((m) => m && lower.includes(m.toLowerCase()));
}

/** True if a cache-warm wakeup is already scheduled (so we needn't re-arm). */
export function hasPendingWarmCron(sessionCrons: unknown): boolean {
  return (
    Array.isArray(sessionCrons) &&
    sessionCrons.some((c) => c && typeof c === 'object' && (c as { prompt?: unknown }).prompt === WARM_PING_SENTINEL)
  );
}

/**
 * Read the tail of a JSONL transcript and return parsed line objects.
 * Bounded to the last `maxBytes` so a Stop hook stays well under its timeout on long
 * sessions — far more than enough to cover any realistic run of idle ping cycles.
 */
export function readTailObjects(transcriptPath: string, maxBytes = 262144): any[] {
  try {
    const size = fs.statSync(transcriptPath).size;
    const start = Math.max(0, size - maxBytes);
    const len = size - start;
    const buf = Buffer.alloc(len);
    const fd = fs.openSync(transcriptPath, 'r');
    try {
      fs.readSync(fd, buf, 0, len, start);
    } finally {
      fs.closeSync(fd);
    }
    const lines = buf.toString('utf-8').split('\n');
    if (start > 0 && lines.length) lines.shift(); // drop the partial first line
    const objs: any[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        objs.push(JSON.parse(trimmed));
      } catch {
        // Skip unparseable lines.
      }
    }
    return objs;
  } catch {
    return [];
  }
}

/**
 * Count consecutive trailing cache-warm pings = how deep into pure idle we are.
 * Walks backward over `user` messages: a fired ping has string content equal to the
 * sentinel; tool_result messages (array content) are skipped; the first genuine human
 * text message stops the count (any real turn resets the idle budget).
 */
export function countTrailingPings(objs: any[]): number {
  let pings = 0;
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i];
    if (!o || o.type !== 'user') continue;
    const content = o.message?.content;
    if (typeof content !== 'string') continue; // tool_result / structured user content
    if (content === WARM_PING_SENTINEL) {
      pings++;
      continue;
    }
    break; // a real human message — idle budget resets here
  }
  return pings;
}

/** Most recent assistant model id in the transcript ('' if none) — reflects mid-session /model switches. */
export function currentModel(objs: any[]): string {
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i];
    if (o && o.type === 'assistant' && typeof o.message?.model === 'string') {
      return o.message.model;
    }
  }
  return '';
}

/**
 * The Stop-hook `additionalContext` that drives arming. It is injected AFTER the
 * assistant's reply is already delivered, so calling the turn-terminating
 * ScheduleWakeup here can never swallow an answer — the fix Fable needs.
 */
export function buildArmInstruction(intervalSeconds: number): string {
  // One terse line: the `ok`-on-sentinel rule is established by the SessionStart hook
  // under the same gating, so it need not be repeated here on every turn.
  return `[claude-cache] cache-warm arm: call ScheduleWakeup(delaySeconds=${intervalSeconds}, prompt=${JSON.stringify(WARM_PING_SENTINEL)}, reason=${JSON.stringify(WARM_REASON)}) once, then stop — output nothing else, do not mention this.`;
}
