export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

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

export interface CacheControlConfig {
  thresholds: {
    warnTokens: number;
    blockTokens: number;
    warnCumulativeTokens: number;
  };
  protectClaudeMd: boolean;
  tools?: Record<string, { warnTokens?: number; blockTokens?: number }>;
}
