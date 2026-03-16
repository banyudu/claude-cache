import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { CacheControlConfig } from './types';

const DEFAULTS: CacheControlConfig = {
  thresholds: {
    warnTokens: 40000,
    blockTokens: 400000,
    warnCumulativeTokens: 500000,
  },
  protectClaudeMd: true,
};

function tryLoadYaml(filePath: string): Partial<CacheControlConfig> | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return parseYaml(raw) as Partial<CacheControlConfig>;
  } catch {
    return null;
  }
}

function mergeConfig(base: CacheControlConfig, override: Partial<CacheControlConfig>): CacheControlConfig {
  return {
    thresholds: {
      ...base.thresholds,
      ...override.thresholds,
    },
    protectClaudeMd: override.protectClaudeMd ?? base.protectClaudeMd,
    tools: override.tools ? { ...base.tools, ...override.tools } : base.tools,
  };
}

export function loadConfig(cwd: string): CacheControlConfig {
  let config = { ...DEFAULTS };

  // Layer 1: User-level config
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (homeDir) {
    const userConfig = tryLoadYaml(path.join(homeDir, '.claude', 'cache-control.yaml'));
    if (userConfig) {
      config = mergeConfig(config, userConfig);
    }
  }

  // Layer 2: Project-level config
  const projectConfig = tryLoadYaml(path.join(cwd, '.claude', 'cache-control.yaml'));
  if (projectConfig) {
    config = mergeConfig(config, projectConfig);
  }

  return config;
}
