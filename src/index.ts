import { analyze } from './analyzer';
import { loadConfig } from './config';
import { loadState, saveState, addOperation, resetState, formatStatus, pruneStaleStates } from './tracker';
import type { HookInput, HookOutput, Decision } from './types';

const MAX_STDIN_SIZE = 1024 * 1024;

function output(decision: Decision, reason: string): void {
  const out: HookOutput = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(out));
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) {
    raw += chunk;
    if (raw.length > MAX_STDIN_SIZE) {
      output('ask', '[cache-control] Input exceeds size limit');
      process.exit(0);
    }
  }

  let input: HookInput;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  // Skip in dangerously-skip-permissions mode
  if (input.permission_mode === 'dangerously-skip-permissions') {
    process.exit(0);
  }

  // Handle magic commands via Bash
  if (input.tool_name === 'Bash') {
    const command = input.tool_input.command as string | undefined;
    if (command?.includes('__CACHE_CONTROL_STATUS__')) {
      const state = loadState(input.session_id);
      output('allow', formatStatus(state));
      process.exit(0);
    }
    if (command?.includes('__CACHE_CONTROL_RESET__')) {
      resetState(input.session_id);
      output('allow', '[cache-control] Session tracking reset');
      process.exit(0);
    }
  }

  // Opportunistically prune stale state files (non-blocking, best-effort)
  try { pruneStaleStates(); } catch { /* ignore */ }

  const config = loadConfig(input.cwd);
  const estimate = analyze(input, config);
  const state = loadState(input.session_id);

  // Get per-tool thresholds if configured
  const toolConfig = config.tools?.[input.tool_name];
  const warnTokens = toolConfig?.warnTokens ?? config.thresholds.warnTokens;
  const blockTokens = toolConfig?.blockTokens ?? config.thresholds.blockTokens;

  let decision: Decision = 'allow';
  let reason = '';

  // CLAUDE.md protection — always ask
  if (estimate.isClaudeMd && config.protectClaudeMd && input.tool_name !== 'Read') {
    decision = 'ask';
    reason = `[cache-control] Modifying CLAUDE.md invalidates the entire cache prefix. ${estimate.reason}`;
  }
  // Block if tokens exceed block threshold
  else if (estimate.estimatedTokens >= blockTokens) {
    decision = 'deny';
    reason = `[cache-control] Operation too large — would add ~${estimate.estimatedTokens.toLocaleString()} tokens to context. ${estimate.reason}`;
  }
  // Warn if tokens exceed warn threshold
  else if (estimate.estimatedTokens >= warnTokens) {
    decision = 'ask';
    reason = `[cache-control] Large operation — ~${estimate.estimatedTokens.toLocaleString()} tokens. ${estimate.reason}`;
  }
  // Warn if cumulative session tokens are high
  else if (state.totalEstimatedTokens + estimate.estimatedTokens >= config.thresholds.warnCumulativeTokens) {
    decision = 'ask';
    reason = `[cache-control] Session cumulative tokens (~${(state.totalEstimatedTokens + estimate.estimatedTokens).toLocaleString()}) exceeds threshold. ${estimate.reason}`;
  }

  // Track the operation
  const newState = addOperation(state, {
    tool: input.tool_name,
    file: (input.tool_input.file_path as string) || undefined,
    estimatedTokens: estimate.estimatedTokens,
  });
  saveState(input.session_id, newState);

  if (decision === 'allow') {
    // Silent exit — don't interfere
    process.exit(0);
  }

  output(decision, reason);
  if (decision === 'deny') {
    process.stderr.write(`${reason}\n`);
    process.exit(2);
  }
  process.exit(0);
}

main().catch(() => process.exit(0));
