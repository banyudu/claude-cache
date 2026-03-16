import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import { analyzeRead, analyzeWrite, analyzeEdit, analyzeBash } from '../analyzer';
import type { HookInput, CacheControlConfig } from '../types';

vi.mock('node:fs');

const config: CacheControlConfig = {
  thresholds: { warnTokens: 40000, blockTokens: 400000, warnCumulativeTokens: 500000 },
  protectClaudeMd: true,
};

function makeInput(tool: string, toolInput: Record<string, unknown>): HookInput {
  return {
    session_id: 'test',
    hook_event_name: 'PreToolUse',
    tool_name: tool,
    tool_input: toolInput,
    cwd: '/tmp',
    permission_mode: 'default',
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('analyzeRead', () => {
  it('estimates tokens from file size', () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 160000 } as fs.Stats);
    const result = analyzeRead(makeInput('Read', { file_path: '/tmp/big.json' }), config);
    expect(result.estimatedTokens).toBe(40000);
    expect(result.risk).toBe('high');
    expect(result.isClaudeMd).toBe(false);
  });

  it('detects CLAUDE.md paths', () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1000 } as fs.Stats);
    const result = analyzeRead(makeInput('Read', { file_path: '/project/CLAUDE.md' }), config);
    expect(result.isClaudeMd).toBe(true);
  });

  it('handles missing file', () => {
    vi.spyOn(fs, 'statSync').mockImplementation(() => { throw new Error('ENOENT'); });
    const result = analyzeRead(makeInput('Read', { file_path: '/tmp/nope.txt' }), config);
    expect(result.estimatedTokens).toBe(0);
    expect(result.risk).toBe('low');
  });

  it('caps estimate with limit param', () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1000000 } as fs.Stats);
    const result = analyzeRead(makeInput('Read', { file_path: '/tmp/big.txt', limit: 100 }), config);
    // limit=100 lines * 80 bytes/line = 8000 bytes => 2000 tokens
    expect(result.estimatedTokens).toBe(2000);
  });
});

describe('analyzeWrite', () => {
  it('estimates tokens from content length', () => {
    const content = 'x'.repeat(160000);
    const result = analyzeWrite(makeInput('Write', { file_path: '/tmp/out.txt', content }), config);
    expect(result.estimatedTokens).toBe(40000);
  });

  it('detects CLAUDE.md writes', () => {
    const result = analyzeWrite(makeInput('Write', { file_path: '/project/CLAUDE.md', content: 'hello' }), config);
    expect(result.isClaudeMd).toBe(true);
  });
});

describe('analyzeEdit', () => {
  it('estimates from new_string length', () => {
    const result = analyzeEdit(makeInput('Edit', { file_path: '/tmp/f.ts', new_string: 'x'.repeat(400) }), config);
    expect(result.estimatedTokens).toBe(100);
    expect(result.risk).toBe('low');
  });

  it('detects .claude/ path edits', () => {
    const result = analyzeEdit(makeInput('Edit', { file_path: '/project/.claude/settings.md', new_string: 'x' }), config);
    expect(result.isClaudeMd).toBe(true);
  });
});

describe('analyzeBash', () => {
  it('estimates for cat commands with file stat', () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 200000 } as fs.Stats);
    const result = analyzeBash(makeInput('Bash', { command: 'cat /tmp/bigfile.log' }), config);
    expect(result.estimatedTokens).toBe(50000);
  });

  it('detects git log as large output', () => {
    const result = analyzeBash(makeInput('Bash', { command: 'git log --oneline' }), config);
    expect(result.estimatedTokens).toBe(25000);
  });

  it('caps estimate with head pipe', () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1000000 } as fs.Stats);
    const result = analyzeBash(makeInput('Bash', { command: 'cat /tmp/big.log | head -n 50' }), config);
    // head caps to 50 * 80 = 4000 bytes => 1000 tokens
    expect(result.estimatedTokens).toBe(1000);
  });

  it('returns low risk for simple commands', () => {
    const result = analyzeBash(makeInput('Bash', { command: 'echo hello' }), config);
    expect(result.estimatedTokens).toBe(0);
    expect(result.risk).toBe('low');
  });
});
