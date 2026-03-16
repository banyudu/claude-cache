import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { loadState, saveState, addOperation, resetState, formatStatus } from '../tracker';

const SESSION_ID = 'test-tracker-session';
const STATE_FILE = `/tmp/claude-cache-control-${SESSION_ID}.json`;

beforeEach(() => {
  try { fs.unlinkSync(STATE_FILE); } catch { /* ignore */ }
});

afterEach(() => {
  try { fs.unlinkSync(STATE_FILE); } catch { /* ignore */ }
});

describe('tracker', () => {
  it('returns empty state for new session', () => {
    const state = loadState(SESSION_ID);
    expect(state.totalEstimatedTokens).toBe(0);
    expect(state.operationCount).toBe(0);
    expect(state.operations).toEqual([]);
  });

  it('saves and loads state', () => {
    const state = { totalEstimatedTokens: 1000, operationCount: 1, operations: [] };
    saveState(SESSION_ID, state);
    const loaded = loadState(SESSION_ID);
    expect(loaded.totalEstimatedTokens).toBe(1000);
  });

  it('adds operations correctly', () => {
    let state = loadState(SESSION_ID);
    state = addOperation(state, { tool: 'Read', file: '/tmp/f.ts', estimatedTokens: 500 });
    expect(state.totalEstimatedTokens).toBe(500);
    expect(state.operationCount).toBe(1);
    state = addOperation(state, { tool: 'Write', file: '/tmp/g.ts', estimatedTokens: 300 });
    expect(state.totalEstimatedTokens).toBe(800);
    expect(state.operationCount).toBe(2);
  });

  it('resets state', () => {
    saveState(SESSION_ID, { totalEstimatedTokens: 1000, operationCount: 5, operations: [] });
    resetState(SESSION_ID);
    const state = loadState(SESSION_ID);
    expect(state.totalEstimatedTokens).toBe(0);
  });

  it('formats status output', () => {
    const state = {
      totalEstimatedTokens: 5000,
      operationCount: 2,
      operations: [
        { tool: 'Read', file: '/tmp/a.ts', estimatedTokens: 3000, timestamp: Date.now() },
        { tool: 'Write', file: '/tmp/b.ts', estimatedTokens: 2000, timestamp: Date.now() },
      ],
    };
    const output = formatStatus(state);
    expect(output).toContain('5,000');
    expect(output).toContain('Operations tracked: 2');
  });
});
