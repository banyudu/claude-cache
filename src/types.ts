export type Decision = 'allow' | 'deny' | 'ask';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface HookInput {
  session_id: string;
  hook_event_name: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  cwd: string;
  permission_mode: string;
}

export interface HookOutput {
  hookSpecificOutput?: {
    hookEventName: string;
    permissionDecision: Decision;
    permissionDecisionReason: string;
  };
}

export interface CacheImpactEstimate {
  estimatedTokens: number;
  risk: RiskLevel;
  reason: string;
  isClaudeMd: boolean;
}

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
