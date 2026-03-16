import * as fs from 'node:fs';
import type { SessionState, OperationRecord } from './types';

function stateFilePath(sessionId: string): string {
  // Sanitize session ID for use as filename
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `/tmp/claude-cache-control-${safe}.json`;
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
  fs.writeFileSync(file, JSON.stringify(state), 'utf-8');
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
