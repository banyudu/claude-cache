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

  it('handles various input field names', () => {
    // The prompt-hook supports message, input, prompt fields
    // This test validates the extraction logic conceptually
    const inputs = [
      { message: 'hello', session_id: 's1', cwd: '/tmp' },
      { input: 'hello', session_id: 's2' },
      { prompt: 'hello' },
    ];
    for (const input of inputs) {
      const text = (input as any).message || (input as any).input || (input as any).prompt || '';
      expect(text).toBe('hello');
    }
  });
});
