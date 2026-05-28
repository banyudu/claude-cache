import { loadConfig } from './config';

const PING = '__cache-warm-ping__';

function buildInstruction(intervalSeconds: number, maxIdleHours: number): string {
  const intervalMin = Math.round(intervalSeconds / 60);
  const maxConsecutivePings = Math.max(
    1,
    Math.floor((maxIdleHours * 3600) / intervalSeconds),
  );
  return [
    `[claude-cache] Prompt-cache warming is ENABLED for this session.`,
    ``,
    `Goal: prevent the Anthropic prompt cache from expiring during idle gaps, so the user's next real prompt is a cache hit instead of a full rebuild. A real assistant turn already refreshes the cache, so we only need a ping when the session has actually gone silent.`,
    ``,
    `Mechanism — re-arm an idle timer at the end of every one of your replies in this session:`,
    ``,
    `  Call \`ScheduleWakeup\` with:`,
    `    delaySeconds: ${intervalSeconds}`,
    `    prompt: ${JSON.stringify(PING)}`,
    `    reason: "claude-cache: idle-timer refresh"`,
    ``,
    `Each new call replaces the previous pending wakeup, so the timer only ever fires after ~${intervalMin} min of silence. If the user keeps chatting, no ping is ever sent.`,
    ``,
    `When you DO receive a user message whose entire content is the literal sentinel ${JSON.stringify(PING)} (the timer fired — true idle), treat it as a heartbeat, not a request:`,
    `  - Do not analyse, do not read files, do not call any tool other than \`ScheduleWakeup\`.`,
    `  - Reply with the single token \`ok\`.`,
    `  - Re-arm by calling \`ScheduleWakeup\` again with the same parameters.`,
    ``,
    `Idle cap: stop re-arming once the run of consecutive ${JSON.stringify(PING)} pings (with no real user message between them) would reach ${maxConsecutivePings} — that corresponds to ~${maxIdleHours} hour(s) of pure idle. To check on each reply: count the trailing ping messages in the transcript since the last real user input. ANY real user message resets that counter — go back to re-arming normally on the next reply.`,
    ``,
    `Also stop if the user says anything like "stop warming", "disable warm", "/warm off", or seems annoyed by the pings. To stop, simply do not call \`ScheduleWakeup\` at the end of that reply — omitting the call ends the loop.`,
    ``,
    `Do this silently: do not announce the wakeup re-arming to the user on every turn. It is bookkeeping.`,
  ].join('\n');
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) {
    raw += chunk;
  }

  let cwd = process.cwd();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.cwd === 'string') cwd = parsed.cwd;
  } catch {
    // Non-JSON stdin — proceed with process.cwd()
  }

  const config = loadConfig(cwd);
  if (!config.warm.enabled) {
    process.exit(0);
  }

  const additionalContext = buildInstruction(config.warm.intervalSeconds, config.warm.maxIdleHours);

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
