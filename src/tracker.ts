import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import type { SessionState, OperationRecord } from './types';

const STATE_DIR = '/tmp';
const STATE_PREFIX = 'claude-cache-control-';
const STATE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function stateFilePath(sessionId: string): string {
  // Hash the session ID to avoid collisions from lossy sanitization
  const hash = crypto.createHash('sha256').update(sessionId).digest('hex').slice(0, 16);
  return `${STATE_DIR}/${STATE_PREFIX}${hash}.json`;
}

export function loadState(sessionId: string): SessionState {
  const file = stateFilePath(sessionId);
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw) as SessionState;
  } catch {
    return { totalEstimatedTokens: 0, operationCount: 0, operations: [] };
  }
}

export function saveState(sessionId: string, state: SessionState): void {
  const file = stateFilePath(sessionId);
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    // Atomic write: write to temp file, then rename
    fs.writeFileSync(tmp, JSON.stringify(state), 'utf-8');
    fs.renameSync(tmp, file);
  } catch {
    // Best-effort cleanup
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

export function addOperation(
  state: SessionState,
  op: Omit<OperationRecord, 'timestamp'>,
): SessionState {
  const record: OperationRecord = { ...op, timestamp: Date.now() };
  return {
    totalEstimatedTokens: state.totalEstimatedTokens + op.estimatedTokens,
    operationCount: state.operationCount + 1,
    operations: [...state.operations, record],
  };
}

export function resetState(sessionId: string): void {
  const file = stateFilePath(sessionId);
  try {
    fs.unlinkSync(file);
  } catch {
    // Ignore if file doesn't exist
  }
}

/** Remove state files older than TTL */
export function pruneStaleStates(): number {
  let pruned = 0;
  try {
    const files = fs.readdirSync(STATE_DIR);
    const now = Date.now();
    for (const file of files) {
      if (!file.startsWith(STATE_PREFIX) || !file.endsWith('.json')) continue;
      const fullPath = `${STATE_DIR}/${file}`;
      try {
        const stat = fs.statSync(fullPath);
        if (now - stat.mtimeMs > STATE_TTL_MS) {
          fs.unlinkSync(fullPath);
          pruned++;
        }
      } catch { /* ignore individual file errors */ }
    }
  } catch { /* ignore readdir errors */ }
  return pruned;
}

export function formatStatus(state: SessionState): string {
  const lines = [
    `[cache-control] Session Stats:`,
    `  Total estimated tokens: ${state.totalEstimatedTokens.toLocaleString()}`,
    `  Operations tracked: ${state.operationCount}`,
  ];

  if (state.operations.length > 0) {
    lines.push(`  Recent operations:`);
    const recent = state.operations.slice(-5);
    for (const op of recent) {
      const time = new Date(op.timestamp).toLocaleTimeString();
      lines.push(`    ${time} ${op.tool} ${op.file || ''} (~${op.estimatedTokens.toLocaleString()} tokens)`);
    }
  }

  return lines.join('\n');
}
