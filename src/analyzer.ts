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

/** Strip surrounding quotes (single or double) from a shell argument */
function stripQuotes(arg: string): string {
  if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
    return arg.slice(1, -1);
  }
  return arg;
}

/**
 * Extract file arguments from a shell command fragment like `cat file1 "file 2" file3`.
 * Handles both quoted and unquoted paths.
 */
function extractFileArgs(command: string, cmdName: string): string[] {
  // Match the command and capture everything after it
  const re = new RegExp(`\\b${cmdName}\\s+(.+?)(?:\\||;|&&|$)`);
  const match = command.match(re);
  if (!match) return [];

  const argsStr = match[1].trim();
  const files: string[] = [];
  // Parse respecting quotes
  let i = 0;
  while (i < argsStr.length) {
    // Skip whitespace
    while (i < argsStr.length && argsStr[i] === ' ') i++;
    if (i >= argsStr.length) break;

    // Skip flags like -n, --number
    if (argsStr[i] === '-') {
      while (i < argsStr.length && argsStr[i] !== ' ') i++;
      continue;
    }

    let arg = '';
    const quote = argsStr[i] === '"' || argsStr[i] === "'" ? argsStr[i] : null;
    if (quote) {
      i++; // skip opening quote
      while (i < argsStr.length && argsStr[i] !== quote) {
        arg += argsStr[i];
        i++;
      }
      i++; // skip closing quote
    } else {
      while (i < argsStr.length && argsStr[i] !== ' ') {
        arg += argsStr[i];
        i++;
      }
    }
    if (arg) files.push(arg);
  }
  return files;
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

  // Account for offset/limit params
  // Use actual file size as upper bound; limit * average-line-length is a rough guess
  // so we take the min of (limit-based estimate, actual size)
  const limit = input.tool_input.limit as number | undefined;
  let estimatedBytes = size;
  if (limit) {
    const limitEstimate = limit * 120; // generous avg line length
    estimatedBytes = Math.min(size, limitEstimate);
  }

  const tokens = estimateTokens(estimatedBytes);
  const risk = classifyRisk(tokens, config);

  return {
    estimatedTokens: tokens,
    risk,
    reason: `Reading ${filePath} (~${tokens.toLocaleString()} tokens, ${formatBytes(estimatedBytes)})`,
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

  // For CLAUDE.md edits, estimate the full file size since the entire cache prefix is invalidated
  let tokens: number;
  let reason: string;
  if (isClaude) {
    const size = safeStatSize(resolved);
    tokens = size !== null ? estimateTokens(size) : (newString ? estimateTokens(Buffer.byteLength(newString, 'utf-8')) : 0);
    reason = `Editing ${filePath} (CLAUDE.md — full cache prefix invalidation, ~${tokens.toLocaleString()} tokens in file)`;
  } else {
    tokens = newString ? estimateTokens(Buffer.byteLength(newString, 'utf-8')) : 0;
    reason = `Editing ${filePath} (~${tokens.toLocaleString()} tokens of new content)`;
  }

  const risk = classifyRisk(tokens, config);

  return { estimatedTokens: tokens, risk, reason, isClaudeMd: isClaude };
}

const FILE_READ_COMMANDS = ['cat', 'less', 'more'];
const LARGE_OUTPUT_PATTERNS = [
  /\bgit\s+log\b/,
  /\bgit\s+diff\b/,
  /\bfind\s+/,
  /\bls\s+-[^\s]*R/,
  /\btree\b/,
];
const OUTPUT_CAP_PATTERNS = [
  /\|\s*head\s+(-n\s*)?(\d+)/,
  /\|\s*tail\s+(-n\s*)?(\d+)/,
];

export function analyzeBash(input: HookInput, config: CacheControlConfig): CacheImpactEstimate {
  const command = input.tool_input.command as string | undefined;
  if (!command) {
    return { estimatedTokens: 0, risk: 'low', reason: 'No command', isClaudeMd: false };
  }

  const isClaude = CLAUDE_MD_PATTERNS.some((p) => p.test(command));

  let estimatedTokens = 0;
  let reason = '';
  let hasFileEstimate = false;
  let hasLargeOutputEstimate = false;

  // Check for file-reading commands — extract all file arguments
  for (const cmd of FILE_READ_COMMANDS) {
    const files = extractFileArgs(command, cmd);
    for (const rawFile of files) {
      const file = stripQuotes(rawFile);
      const filePath = resolveFilePath(file, input.cwd);
      const size = safeStatSize(filePath);
      if (size !== null) {
        estimatedTokens += estimateTokens(size);
        hasFileEstimate = true;
      }
    }
    if (files.length > 0 && hasFileEstimate) {
      reason = `Bash reads ${files.length} file(s) (~${estimatedTokens.toLocaleString()} tokens)`;
    }
  }

  // Check for commands that produce large output
  for (const pattern of LARGE_OUTPUT_PATTERNS) {
    if (pattern.test(command)) {
      const estimate = 25000;
      if (!hasFileEstimate) {
        estimatedTokens = Math.max(estimatedTokens, estimate);
      }
      hasLargeOutputEstimate = true;
      reason = reason || `Bash command may produce large output (~${estimate.toLocaleString()} tokens)`;
    }
  }

  // Check for output caps (head/tail pipes) — only apply if we have some estimate to cap
  if (estimatedTokens > 0) {
    for (const pattern of OUTPUT_CAP_PATTERNS) {
      const match = command.match(pattern);
      if (match) {
        const lines = parseInt(match[2] || '10', 10);
        const cappedTokens = estimateTokens(lines * 120);
        estimatedTokens = Math.min(estimatedTokens, cappedTokens);
        reason = `Bash output capped by pipe (~${cappedTokens.toLocaleString()} tokens)`;
      }
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
