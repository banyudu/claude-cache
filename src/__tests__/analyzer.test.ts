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
    // limit=100 lines * 120 bytes/line = 12000 bytes => 3000 tokens
    expect(result.estimatedTokens).toBe(3000);
  });

  it('limit does not exceed actual file size', () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 500 } as fs.Stats);
    const result = analyzeRead(makeInput('Read', { file_path: '/tmp/small.txt', limit: 100 }), config);
    // limit*120 = 12000, but file is only 500 bytes => 125 tokens
    expect(result.estimatedTokens).toBe(125);
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
  it('estimates from new_string length for regular files', () => {
    const result = analyzeEdit(makeInput('Edit', { file_path: '/tmp/f.ts', new_string: 'x'.repeat(400) }), config);
    expect(result.estimatedTokens).toBe(100);
    expect(result.risk).toBe('low');
  });

  it('detects .claude/ path edits', () => {
    const result = analyzeEdit(makeInput('Edit', { file_path: '/project/.claude/settings.md', new_string: 'x' }), config);
    expect(result.isClaudeMd).toBe(true);
  });

  it('estimates full file size for CLAUDE.md edits', () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 8000 } as fs.Stats);
    const result = analyzeEdit(makeInput('Edit', { file_path: '/project/CLAUDE.md', new_string: 'small change' }), config);
    // Should use full file size (8000 bytes => 2000 tokens), not just new_string
    expect(result.estimatedTokens).toBe(2000);
    expect(result.reason).toContain('full cache prefix invalidation');
  });
});

describe('analyzeBash', () => {
  it('estimates for cat with multiple files', () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 100000 } as fs.Stats);
    const result = analyzeBash(makeInput('Bash', { command: 'cat /tmp/a.log /tmp/b.log' }), config);
    // Two files of 100KB each => 50000 tokens total
    expect(result.estimatedTokens).toBe(50000);
    expect(result.reason).toContain('2 file(s)');
  });

  it('handles cat with quoted paths', () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 40000 } as fs.Stats);
    const result = analyzeBash(makeInput('Bash', { command: 'cat "/tmp/path with spaces/file.txt"' }), config);
    expect(result.estimatedTokens).toBe(10000);
  });

  it('detects git log as large output', () => {
    const result = analyzeBash(makeInput('Bash', { command: 'git log --oneline' }), config);
    expect(result.estimatedTokens).toBe(25000);
  });

  it('caps estimate with head pipe', () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1000000 } as fs.Stats);
    const result = analyzeBash(makeInput('Bash', { command: 'cat /tmp/big.log | head -n 50' }), config);
    // head caps to 50 * 120 = 6000 bytes => 1500 tokens
    expect(result.estimatedTokens).toBe(1500);
  });

  it('does not apply cap when there is no base estimate', () => {
    const result = analyzeBash(makeInput('Bash', { command: 'echo hello | head -n 5' }), config);
    // No file read or large output pattern => 0 tokens, cap not applied
    expect(result.estimatedTokens).toBe(0);
  });

  it('returns low risk for simple commands', () => {
    const result = analyzeBash(makeInput('Bash', { command: 'echo hello' }), config);
    expect(result.estimatedTokens).toBe(0);
    expect(result.risk).toBe('low');
  });
});
