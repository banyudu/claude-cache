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

export interface WarmConfig {
  enabled: boolean;
  intervalSeconds: number;
  maxIdleHours: number;
  // Optional escape hatch: skip warming when the session model matches any entry
  // (case-insensitive substring of the SessionStart `model`, e.g. "claude-fable-5").
  // Arming is Stop-hook-driven and happens AFTER the reply, so no model needs this
  // anymore — kept only as a manual override. Defaults to [] (warm every model).
  excludeModels: string[];
  // When true, re-arm the idle timer on every Stop (slides the deadline forward so a
  // ping never fires mid-activity), at the cost of one tiny arming micro-turn per user
  // turn. When false (default), re-arm only when no cache-warm wakeup is pending — no
  // extra turns during active chatting; a marathon session past the interval fires one
  // stray ping that self-corrects.
  rearmEveryTurn: boolean;
}

export interface CacheControlConfig {
  contextSize: number;
  thresholds: ResolvedThresholds;
  protectClaudeMd: boolean;
  tools?: Record<string, { warnTokens?: TokenThreshold; blockTokens?: TokenThreshold }>;
  warm: WarmConfig;
}

export interface RawCacheControlConfig {
  contextSize?: number;
  thresholds?: Partial<RawThresholds>;
  protectClaudeMd?: boolean;
  tools?: Record<string, { warnTokens?: TokenThreshold; blockTokens?: TokenThreshold }>;
  warm?: Partial<WarmConfig>;
}
