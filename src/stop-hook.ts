import { loadConfig } from './config';
import {
  buildArmInstruction,
  countTrailingPings,
  currentModel,
  hasPendingWarmCron,
  maxConsecutivePings,
  modelExcluded,
  readTailObjects,
} from './warm';

/**
 * Stop-hook handler — drives cache-warm arming AFTER the assistant's reply is delivered.
 *
 * Claude Code sends JSON on stdin shaped like:
 *   { hook_event_name: "Stop", stop_hook_active: boolean, transcript_path: string,
 *     cwd: string, session_crons?: Array<{ prompt?: string, ... }> }
 *
 * Output `{ hookSpecificOutput: { hookEventName: "Stop", additionalContext } }` continues
 * the conversation so the model performs one isolated ScheduleWakeup micro-turn. Because
 * the real answer is already on screen, arming can never swallow it — for any model.
 *
 * Exit 0 with no output = allow the turn to end (no warming this cycle).
 */
async function main() {
  let raw = '';
  for await (const chunk of process.stdin) {
    raw += chunk;
  }

  let cwd = process.cwd();
  let stopActive = false;
  let sessionCrons: unknown = [];
  let transcriptPath = '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.cwd === 'string') cwd = parsed.cwd;
    stopActive = parsed?.stop_hook_active === true;
    sessionCrons = parsed?.session_crons;
    if (parsed && typeof parsed.transcript_path === 'string') transcriptPath = parsed.transcript_path;
  } catch {
    // Non-JSON stdin — nothing to do.
  }

  const config = loadConfig(cwd);
  if (!config.warm.enabled) {
    process.exit(0);
  }

  // Loop guard: we're already inside the arming continuation we requested — let it stop.
  if (stopActive) {
    process.exit(0);
  }

  const objs = transcriptPath ? readTailObjects(transcriptPath) : [];

  // Authoritative model gate: read the live model from the transcript, so it also
  // honours a mid-session /model switch (SessionStart alone can't see that).
  if (modelExcluded(currentModel(objs), config.warm.excludeModels)) {
    process.exit(0);
  }

  // Keep active chatting free of extra turns: if a wakeup is already pending, leave it.
  // (rearmEveryTurn slides the deadline forward every turn instead, at a small cost.)
  if (!config.warm.rearmEveryTurn && hasPendingWarmCron(sessionCrons)) {
    process.exit(0);
  }

  // Idle cap: once we've pinged through the whole idle budget, stop re-arming.
  const cap = maxConsecutivePings(config.warm.intervalSeconds, config.warm.maxIdleHours);
  if (countTrailingPings(objs) >= cap) {
    process.exit(0);
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext: buildArmInstruction(config.warm.intervalSeconds),
      },
    }),
  );
  process.exit(0);
}

main().catch(() => process.exit(0));
