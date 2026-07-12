import { loadConfig } from './config';
import { WARM_PING_SENTINEL, modelExcluded } from './warm';

const PING = WARM_PING_SENTINEL;

function buildInstruction(): string {
  return [
    `[claude-cache] Prompt-cache warming is enabled for this session.`,
    ``,
    `Arming is automatic: a Stop hook re-arms the idle timer AFTER each of your replies. You do NOT do it yourself — never proactively call \`ScheduleWakeup\` for cache warming at the end of a normal turn. You will be asked to, explicitly, once your answer has already been delivered; only schedule it then.`,
    ``,
    `If you receive a user message whose entire content is exactly the sentinel ${JSON.stringify(PING)}, that is the idle timer firing — a heartbeat, not a request. Reply with just \`ok\` and nothing else: no tools, no analysis.`,
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

  // Optional manual override: skip the warm instruction for excluded models. SessionStart
  // passes `model`; the Stop hook enforces the same gate from the live transcript model, so
  // this only suppresses the startup note (fires on startup/resume/clear/compact).
  if (modelExcluded(model, config.warm.excludeModels)) {
    process.exit(0);
  }

  const additionalContext = buildInstruction();

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
