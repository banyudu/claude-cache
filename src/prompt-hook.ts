import { estimateTokens } from './estimator';
import { loadState } from './tracker';
import { loadConfig } from './config';

/**
 * Prompt-submit hook handler.
 * Reads user prompt from stdin, checks if it's very large or session is near capacity.
 * Exit 0 with no output = allow, output JSON warning = ask for confirmation.
 */
async function main() {
  let raw = '';
  for await (const chunk of process.stdin) {
    raw += chunk;
  }

  let hookInput: { input?: string; session_id?: string; cwd?: string };
  try {
    hookInput = JSON.parse(raw);
  } catch {
    // Not JSON — treat raw as the prompt itself
    hookInput = { input: raw };
  }

  const prompt = hookInput.input || raw;
  const sessionId = hookInput.session_id || 'unknown';
  const cwd = hookInput.cwd || process.cwd();

  const config = loadConfig(cwd);
  const promptTokens = estimateTokens(Buffer.byteLength(prompt, 'utf-8'));

  // Check if prompt itself is very large
  if (promptTokens >= config.thresholds.warnTokens) {
    const output = {
      decision: 'ask',
      message: `[cache-control] Your prompt is ~${promptTokens.toLocaleString()} tokens. Large prompts shift cache boundaries and increase costs. Continue?`,
    };
    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  }

  // Check cumulative session state
  const state = loadState(sessionId);
  if (state.totalEstimatedTokens + promptTokens >= config.thresholds.warnCumulativeTokens) {
    const total = state.totalEstimatedTokens + promptTokens;
    const output = {
      decision: 'ask',
      message: `[cache-control] Session cumulative tokens (~${total.toLocaleString()}) is high. Consider starting a new conversation to reduce cache rebuild costs.`,
    };
    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  }

  // Allow — silent exit
  process.exit(0);
}

main().catch(() => process.exit(0));
