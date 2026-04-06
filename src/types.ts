export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type TokenThreshold = number | string;

export interface OperationRecord {
  tool: string;
  file?: string;
  estimatedTokens: number;
  timestamp: number;
}

export interface SessionState {
  totalEstimatedTokens: number;
  operationCount: number;
  operations: OperationRecord[];
}

export interface RawThresholds {
  warnTokens: TokenThreshold;
  blockTokens: TokenThreshold;
  warnCumulativeTokens: TokenThreshold;
}

export interface ResolvedThresholds {
  warnTokens: number;
  blockTokens: number;
  warnCumulativeTokens: number;
}

export interface CacheControlConfig {
  contextSize: number;
  thresholds: ResolvedThresholds;
  protectClaudeMd: boolean;
  tools?: Record<string, { warnTokens?: TokenThreshold; blockTokens?: TokenThreshold }>;
}

export interface RawCacheControlConfig {
  contextSize?: number;
  thresholds?: Partial<RawThresholds>;
  protectClaudeMd?: boolean;
  tools?: Record<string, { warnTokens?: TokenThreshold; blockTokens?: TokenThreshold }>;
}
