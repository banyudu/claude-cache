import { estimateTokens } from './estimator';
import { loadState } from './tracker';
import { loadConfig } from './config';

/**
 * Prompt-submit hook handler.
 *
 * Claude Code's user-prompt-submit-hook sends JSON on stdin with the shape:
 *   { hook_event_name: "UserPromptSubmit", session_id: string, message: string, cwd: string }
 *
 * We also handle plain-text stdin and the alternative { input } shape for resilience.
 *
 * Exit 0 with no output = allow. Output JSON = feedback to user.
 */
async function main() {
  let raw = '';
  for await (const chunk of process.stdin) {
    raw += chunk;
  }

  let prompt = raw;
  let sessionId = 'unknown';
  let cwd = process.cwd();

  try {
    const parsed = JSON.parse(raw);
    // Support multiple possible field names for the prompt content
    prompt = parsed.message || parsed.input || parsed.prompt || raw;
    sessionId = parsed.session_id || 'unknown';
    cwd = parsed.cwd || process.cwd();
  } catch {
    // Not JSON — treat raw as the prompt itself
  }

  const config = loadConfig(cwd);
  const promptTokens = estimateTokens(Buffer.byteLength(prompt, 'utf-8'));

  // Check if prompt itself is very large
  if (promptTokens >= config.thresholds.warnTokens) {
    const reason = `[cache-control] Your prompt is ~${promptTokens.toLocaleString()} tokens. Large prompts shift cache boundaries and increase costs. Continue?`;
    process.stderr.write(reason + '\n');
    process.exit(2);
  }

  // Check cumulative session state
  const state = loadState(sessionId);
  if (state.totalEstimatedTokens + promptTokens >= config.thresholds.warnCumulativeTokens) {
    const total = state.totalEstimatedTokens + promptTokens;
    const reason = `[cache-control] Session cumulative tokens (~${total.toLocaleString()}) is high. Consider starting a new conversation to reduce cache rebuild costs.`;
    process.stderr.write(reason + '\n');
    process.exit(2);
  }

  // Allow — silent exit
  process.exit(0);
}

main().catch(() => process.exit(0));
