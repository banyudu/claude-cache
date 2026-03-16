import type { RiskLevel, CacheControlConfig } from './types';

export function estimateTokens(bytes: number): number {
  return Math.ceil(bytes / 4);
}

export function classifyRisk(tokens: number, config: CacheControlConfig): RiskLevel {
  if (tokens >= config.thresholds.blockTokens) return 'critical';
  if (tokens >= config.thresholds.warnTokens) return 'high';
  if (tokens >= config.thresholds.warnTokens * 0.5) return 'medium';
  return 'low';
}
