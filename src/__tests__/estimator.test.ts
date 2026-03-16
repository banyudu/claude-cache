import { describe, it, expect } from 'vitest';
import { estimateTokens, classifyRisk } from '../estimator';
import type { CacheControlConfig } from '../types';

const config: CacheControlConfig = {
  thresholds: { warnTokens: 40000, blockTokens: 400000, warnCumulativeTokens: 500000 },
  protectClaudeMd: true,
};

describe('estimateTokens', () => {
  it('returns bytes / 4 rounded up', () => {
    expect(estimateTokens(100)).toBe(25);
    expect(estimateTokens(101)).toBe(26);
    expect(estimateTokens(0)).toBe(0);
    expect(estimateTokens(1)).toBe(1);
  });
});

describe('classifyRisk', () => {
  it('returns low for small token counts', () => {
    expect(classifyRisk(1000, config)).toBe('low');
  });

  it('returns medium near half the warn threshold', () => {
    expect(classifyRisk(20000, config)).toBe('medium');
  });

  it('returns high at warn threshold', () => {
    expect(classifyRisk(40000, config)).toBe('high');
  });

  it('returns critical at block threshold', () => {
    expect(classifyRisk(400000, config)).toBe('critical');
  });
});
