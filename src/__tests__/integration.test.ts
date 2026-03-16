import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import { analyze } from '../analyzer';
import { loadConfig } from '../config';
import { loadState, addOperation, saveState, resetState } from '../tracker';
import type { HookInput } from '../types';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    statSync: vi.fn(actual.statSync),
    readFileSync: vi.fn(actual.readFileSync),
    writeFileSync: vi.fn(actual.writeFileSync),
    unlinkSync: vi.fn(actual.unlinkSync),
  };
});

const SESSION = 'integration-test';

beforeEach(() => {
  vi.restoreAllMocks();
  // Mock config file reads to return defaults
  vi.spyOn(fs, 'readFileSync').mockImplementation((path) => {
    if (typeof path === 'string' && path.includes('cache-control.yaml')) {
      throw new Error('ENOENT');
    }
    throw new Error('ENOENT');
  });
});

function makeInput(tool: string, toolInput: Record<string, unknown>): HookInput {
  return {
    session_id: SESSION,
    hook_event_name: 'PreToolUse',
    tool_name: tool,
    tool_input: toolInput,
    cwd: '/tmp',
    permission_mode: 'default',
  };
}

describe('integration: full pipeline', () => {
  it('allows small Read operations', () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1000 } as fs.Stats);
    const config = loadConfig('/tmp');
    const estimate = analyze(makeInput('Read', { file_path: '/tmp/small.ts' }), config);
    expect(estimate.risk).toBe('low');
    expect(estimate.estimatedTokens).toBe(250);
  });

  it('warns on large Read operations', () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 200000 } as fs.Stats);
    const config = loadConfig('/tmp');
    const estimate = analyze(makeInput('Read', { file_path: '/tmp/big.json' }), config);
    expect(estimate.risk).toBe('high');
    expect(estimate.estimatedTokens).toBe(50000);
  });

  it('blocks very large Write operations', () => {
    const config = loadConfig('/tmp');
    const content = 'x'.repeat(2000000); // 2MB
    const estimate = analyze(makeInput('Write', { file_path: '/tmp/huge.txt', content }), config);
    expect(estimate.risk).toBe('critical');
    expect(estimate.estimatedTokens).toBe(500000);
  });

  it('flags CLAUDE.md modifications', () => {
    const config = loadConfig('/tmp');
    const estimate = analyze(
      makeInput('Write', { file_path: '/project/CLAUDE.md', content: 'new rules' }),
      config,
    );
    expect(estimate.isClaudeMd).toBe(true);
  });

  it('tracks cumulative tokens across operations', () => {
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

    let state = { totalEstimatedTokens: 0, operationCount: 0, operations: [] as any[] };
    state = addOperation(state, { tool: 'Read', file: '/tmp/a.ts', estimatedTokens: 10000 });
    state = addOperation(state, { tool: 'Read', file: '/tmp/b.ts', estimatedTokens: 20000 });
    state = addOperation(state, { tool: 'Write', file: '/tmp/c.ts', estimatedTokens: 5000 });

    expect(state.totalEstimatedTokens).toBe(35000);
    expect(state.operationCount).toBe(3);
  });
});
