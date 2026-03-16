import * as fs from 'node:fs';
import * as path from 'node:path';
import { estimateTokens, classifyRisk } from './estimator';
import type { CacheImpactEstimate, CacheControlConfig, HookInput } from './types';

const CLAUDE_MD_PATTERNS = [/CLAUDE\.md$/i, /\.claude\/.*\.md$/i];

function isClaudeMdPath(filePath: string): boolean {
  return CLAUDE_MD_PATTERNS.some((p) => p.test(filePath));
}

function safeStatSize(filePath: string): number | null {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

function resolveFilePath(filePath: string, cwd: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
}

export function analyzeRead(input: HookInput, config: CacheControlConfig): CacheImpactEstimate {
  const filePath = input.tool_input.file_path as string | undefined;
  if (!filePath) {
    return { estimatedTokens: 0, risk: 'low', reason: 'No file path', isClaudeMd: false };
  }

  const resolved = resolveFilePath(filePath, input.cwd);
  const isClaude = isClaudeMdPath(resolved);
  const size = safeStatSize(resolved);

  if (size === null) {
    return { estimatedTokens: 0, risk: 'low', reason: 'File not found or inaccessible', isClaudeMd: isClaude };
  }

  // Account for offset/limit params — if limit is set, cap the estimated size
  const limit = input.tool_input.limit as number | undefined;
  const estimatedBytes = limit ? Math.min(size, limit * 80) : size; // ~80 bytes per line estimate

  const tokens = estimateTokens(estimatedBytes);
  const risk = classifyRisk(tokens, config);

  return {
    estimatedTokens: tokens,
    risk,
    reason: `Reading ${filePath} (~${tokens.toLocaleString()} tokens)`,
    isClaudeMd: isClaude,
  };
}

export function analyzeWrite(input: HookInput, config: CacheControlConfig): CacheImpactEstimate {
  const filePath = input.tool_input.file_path as string | undefined;
  const content = input.tool_input.content as string | undefined;

  if (!filePath || !content) {
    return { estimatedTokens: 0, risk: 'low', reason: 'Missing file_path or content', isClaudeMd: false };
  }

  const resolved = resolveFilePath(filePath, input.cwd);
  const isClaude = isClaudeMdPath(resolved);
  const tokens = estimateTokens(Buffer.byteLength(content, 'utf-8'));
  const risk = classifyRisk(tokens, config);

  return {
    estimatedTokens: tokens,
    risk,
    reason: `Writing ${filePath} (~${tokens.toLocaleString()} tokens)`,
    isClaudeMd: isClaude,
  };
}

export function analyzeEdit(input: HookInput, config: CacheControlConfig): CacheImpactEstimate {
  const filePath = input.tool_input.file_path as string | undefined;
  const newString = input.tool_input.new_string as string | undefined;

  if (!filePath) {
    return { estimatedTokens: 0, risk: 'low', reason: 'Missing file_path', isClaudeMd: false };
  }

  const resolved = resolveFilePath(filePath, input.cwd);
  const isClaude = isClaudeMdPath(resolved);
  const tokens = newString ? estimateTokens(Buffer.byteLength(newString, 'utf-8')) : 0;
  const risk = classifyRisk(tokens, config);

  return {
    estimatedTokens: tokens,
    risk,
    reason: `Editing ${filePath} (~${tokens.toLocaleString()} tokens of new content)`,
    isClaudeMd: isClaude,
  };
}

// Patterns in bash commands that read files and produce large output
const FILE_READ_PATTERNS = [
  /\bcat\s+(\S+)/,
  /\bless\s+(\S+)/,
  /\bmore\s+(\S+)/,
];
const LARGE_OUTPUT_PATTERNS = [
  /\bgit\s+log\b/,
  /\bgit\s+diff\b/,
  /\bfind\s+/,
  /\bls\s+-[^\s]*R/,
  /\btree\b/,
];
const OUTPUT_CAP_PATTERNS = [
  /\|\s*head\s+(-n\s+)?(\d+)/,
  /\|\s*tail\s+(-n\s+)?(\d+)/,
];

export function analyzeBash(input: HookInput, config: CacheControlConfig): CacheImpactEstimate {
  const command = input.tool_input.command as string | undefined;
  if (!command) {
    return { estimatedTokens: 0, risk: 'low', reason: 'No command', isClaudeMd: false };
  }

  // Check for CLAUDE.md modification
  const isClaude = CLAUDE_MD_PATTERNS.some((p) => p.test(command));

  let estimatedTokens = 0;
  let reason = '';

  // Check for file-reading commands
  for (const pattern of FILE_READ_PATTERNS) {
    const match = command.match(pattern);
    if (match) {
      const filePath = resolveFilePath(match[1], input.cwd);
      const size = safeStatSize(filePath);
      if (size !== null) {
        estimatedTokens = Math.max(estimatedTokens, estimateTokens(size));
        reason = `Bash reads ${match[1]} (~${estimateTokens(size).toLocaleString()} tokens)`;
      }
    }
  }

  // Check for commands that produce large output
  for (const pattern of LARGE_OUTPUT_PATTERNS) {
    if (pattern.test(command)) {
      // Conservative estimate for unbounded git log/diff/find
      const estimate = 25000;
      estimatedTokens = Math.max(estimatedTokens, estimate);
      reason = reason || `Bash command may produce large output (~${estimate.toLocaleString()} tokens)`;
    }
  }

  // Check for output caps (head/tail pipes)
  for (const pattern of OUTPUT_CAP_PATTERNS) {
    const match = command.match(pattern);
    if (match) {
      const lines = parseInt(match[2] || '10', 10);
      const cappedTokens = estimateTokens(lines * 80);
      estimatedTokens = Math.min(estimatedTokens, cappedTokens);
      reason = `Bash output capped by pipe (~${cappedTokens.toLocaleString()} tokens)`;
    }
  }

  if (!reason) {
    reason = 'Bash command (no large output detected)';
  }

  const risk = classifyRisk(estimatedTokens, config);
  return { estimatedTokens, risk, reason, isClaudeMd: isClaude };
}

export function analyze(input: HookInput, config: CacheControlConfig): CacheImpactEstimate {
  switch (input.tool_name) {
    case 'Read': return analyzeRead(input, config);
    case 'Write': return analyzeWrite(input, config);
    case 'Edit': return analyzeEdit(input, config);
    case 'Bash': return analyzeBash(input, config);
    default:
      return { estimatedTokens: 0, risk: 'low', reason: `Unknown tool: ${input.tool_name}`, isClaudeMd: false };
  }
}
