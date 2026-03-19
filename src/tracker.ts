import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import type { SessionState } from './types';

const STATE_DIR = '/tmp';
const STATE_PREFIX = 'claude-cache-control-';

function stateFilePath(sessionId: string): string {
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
