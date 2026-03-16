import { describe, it, expect } from 'vitest';
import { estimateTokens } from '../estimator';

describe('prompt-hook logic', () => {
  it('estimates prompt tokens correctly', () => {
    const prompt = 'x'.repeat(160000); // 160KB
    const tokens = estimateTokens(Buffer.byteLength(prompt, 'utf-8'));
    expect(tokens).toBe(40000);
  });

  it('small prompts are under warn threshold', () => {
    const prompt = 'Hello, please help me fix this bug.';
    const tokens = estimateTokens(Buffer.byteLength(prompt, 'utf-8'));
    expect(tokens).toBeLessThan(40000);
  });
});
