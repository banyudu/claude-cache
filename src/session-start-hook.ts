import { loadConfig } from './config';
import { WARM_PING_SENTINEL, WARM_REASON, cronForDelay, modelExcluded } from './warm';

/**
 * SessionStart hook — injects the cache-warm protocol once per session (start/resume/
 * clear/compact). The model arms a one-shot CronCreate during its first reply (non-
 * terminating, so it cannot swallow the answer) and re-arms via ScheduleWakeup on each
 * fired ping. No Stop hook is involved, so nothing is injected after replies.
 *
 * Claude Code sends JSON on stdin shaped like:
 *   { hook_event_name: "SessionStart", cwd: string, model?: string, ... }
 *
 * Exit 0 with no output = emit nothing (warming disabled, or model excluded).
 */
function buildInstruction(intervalSeconds: number): string {
  const cron = cronForDelay(intervalSeconds);
  return [
    `[claude-cache] Prompt-cache warming is enabled for this session.`,
    ``,
    `Arm the idle warm timer ONCE during this turn by calling CronCreate with:`,
    `    cron: ${JSON.stringify(cron)}`,
    `    recurring: false`,
    `    prompt: ${JSON.stringify(WARM_PING_SENTINEL)}`,
    `CronCreate does NOT end your turn, so call it alongside your normal reply — it will not interrupt or swallow your answer. Arm at most once per session, and never use ScheduleWakeup for this initial arm.`,
    ``,
    `If you later receive a user message whose entire content is exactly the sentinel ${JSON.stringify(WARM_PING_SENTINEL)}, that is the timer firing — a heartbeat, not a request. Reply with just \`ok\`, then re-arm the next cycle by calling ScheduleWakeup(delaySeconds: ${intervalSeconds}, prompt: ${JSON.stringify(WARM_PING_SENTINEL)}, reason: ${JSON.stringify(WARM_REASON)}). Emit nothing else on that turn.`,
  ].join('\n');
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) {
    raw += chunk;
  }

  let cwd = process.cwd();
  let model = '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.cwd === 'string') cwd = parsed.cwd;
    if (parsed && typeof parsed.model === 'string') model = parsed.model;
  } catch {
    // Non-JSON stdin — proceed with process.cwd()
  }

  const config = loadConfig(cwd);
  if (!config.warm.enabled) {
    process.exit(0);
  }

  if (modelExcluded(model, config.warm.excludeModels)) {
    process.exit(0);
  }

  const additionalContext = buildInstruction(config.warm.intervalSeconds);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext,
      },
    }),
  );
  process.exit(0);
}

main().catch(() => process.exit(0));
