import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { CacheControlConfig, RawCacheControlConfig, TokenThreshold } from './types';

const DEFAULT_CONTEXT_SIZE = 200000;

const DEFAULTS: CacheControlConfig = {
  contextSize: DEFAULT_CONTEXT_SIZE,
  thresholds: {
    warnTokens: 40000,
    blockTokens: 100000,
    warnCumulativeTokens: 200000,
  },
  protectClaudeMd: true,
};

const DEFAULT_RAW_THRESHOLDS = {
  warnTokens: '20%' as TokenThreshold,
  blockTokens: '50%' as TokenThreshold,
  warnCumulativeTokens: '100%' as TokenThreshold,
};

export function resolveThreshold(value: TokenThreshold, contextSize: number): number {
  if (typeof value === 'number') return value;
  const str = String(value).trim();
  if (str.endsWith('%')) {
    const pct = parseFloat(str.slice(0, -1));
    if (isNaN(pct)) return 0;
    return Math.round((pct / 100) * contextSize);
  }
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}

function tryLoadYaml(filePath: string): RawCacheControlConfig | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return parseYaml(raw) as RawCacheControlConfig;
  } catch {
    return null;
  }
}

export function loadConfig(cwd: string): CacheControlConfig {
  const layers: RawCacheControlConfig[] = [];

  // Layer 1: User-level config
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (homeDir) {
    const userConfig = tryLoadYaml(path.join(homeDir, '.claude', 'cache-control.yaml'));
    if (userConfig) layers.push(userConfig);
  }

  // Layer 2: Project-level config
  const projectConfig = tryLoadYaml(path.join(cwd, '.claude', 'cache-control.yaml'));
  if (projectConfig) layers.push(projectConfig);

  // Determine contextSize from layers (last one wins)
  let contextSize = DEFAULT_CONTEXT_SIZE;
  for (const layer of layers) {
    if (layer.contextSize != null) contextSize = layer.contextSize;
  }

  // Merge raw thresholds
  let rawThresholds = { ...DEFAULT_RAW_THRESHOLDS };
  for (const layer of layers) {
    if (layer.thresholds) {
      rawThresholds = { ...rawThresholds, ...layer.thresholds };
    }
  }

  // Resolve percentages against contextSize
  const thresholds = {
    warnTokens: resolveThreshold(rawThresholds.warnTokens, contextSize),
    blockTokens: resolveThreshold(rawThresholds.blockTokens, contextSize),
    warnCumulativeTokens: resolveThreshold(rawThresholds.warnCumulativeTokens, contextSize),
  };

  // Merge other fields
  let protectClaudeMd = DEFAULTS.protectClaudeMd;
  let tools = DEFAULTS.tools;
  for (const layer of layers) {
    if (layer.protectClaudeMd != null) protectClaudeMd = layer.protectClaudeMd;
    if (layer.tools) tools = { ...tools, ...layer.tools };
  }

  return { contextSize, thresholds, protectClaudeMd, tools };
}
