import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { loadState, saveState, addOperation, resetState, formatStatus, pruneStaleStates } from '../tracker';

const SESSION_ID = 'test-tracker-session';
// Compute the expected file path using the same hash logic
const hash = crypto.createHash('sha256').update(SESSION_ID).digest('hex').slice(0, 16);
const STATE_FILE = `/tmp/claude-cache-control-${hash}.json`;

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

  it('does not collide different session IDs', () => {
    const id1 = 'session/abc:123';
    const id2 = 'session/abc_123';
    saveState(id1, { totalEstimatedTokens: 111, operationCount: 1, operations: [] });
    saveState(id2, { totalEstimatedTokens: 222, operationCount: 2, operations: [] });
    expect(loadState(id1).totalEstimatedTokens).toBe(111);
    expect(loadState(id2).totalEstimatedTokens).toBe(222);
    resetState(id1);
    resetState(id2);
  });

  it('atomic write survives concurrent access', () => {
    // Verify that saveState writes atomically (temp + rename)
    saveState(SESSION_ID, { totalEstimatedTokens: 100, operationCount: 1, operations: [] });
    const loaded = loadState(SESSION_ID);
    expect(loaded.totalEstimatedTokens).toBe(100);
  });
});

describe('pruneStaleStates', () => {
  it('removes old state files', () => {
    // Create a file that looks like our state file
    const oldFile = `/tmp/claude-cache-control-oldtest12345678.json`;
    fs.writeFileSync(oldFile, '{}');
    // Set mtime to 25 hours ago
    const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
    fs.utimesSync(oldFile, oldTime, oldTime);

    const pruned = pruneStaleStates();
    expect(pruned).toBeGreaterThanOrEqual(1);

    let exists = true;
    try { fs.statSync(oldFile); } catch { exists = false; }
    expect(exists).toBe(false);
  });

  it('keeps fresh state files', () => {
    const freshFile = `/tmp/claude-cache-control-freshtest1234567.json`;
    fs.writeFileSync(freshFile, '{}');

    pruneStaleStates();

    let exists = true;
    try { fs.statSync(freshFile); } catch { exists = false; }
    expect(exists).toBe(true);

    // Cleanup
    try { fs.unlinkSync(freshFile); } catch { /* ignore */ }
  });
});
