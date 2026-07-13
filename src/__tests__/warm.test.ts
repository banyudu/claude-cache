import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawnSync } from 'node:child_process';
import { loadConfig } from '../config';
import { cronForDelay } from '../warm';

function makeTmpCwd(yaml?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-warm-'));
  if (yaml != null) {
    const claudeDir = path.join(dir, '.claude');
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(path.join(claudeDir, 'cache-control.yaml'), yaml);
  }
  return dir;
}

describe('warm config loading', () => {
  let homeBackup: string | undefined;
  let fakeHome: string;

  beforeEach(() => {
    fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-warm-home-'));
    homeBackup = process.env.HOME;
    process.env.HOME = fakeHome;
  });

  afterEach(() => {
    if (homeBackup === undefined) delete process.env.HOME;
    else process.env.HOME = homeBackup;
    fs.rmSync(fakeHome, { recursive: true, force: true });
  });

  it('returns built-in defaults when no config files exist', () => {
    const cwd = makeTmpCwd();
    const cfg = loadConfig(cwd);
    expect(cfg.warm).toEqual({
      enabled: true,
      intervalSeconds: 3000,
      excludeModels: [],
    });
  });

  it('lets a project-level config disable warming', () => {
    const cwd = makeTmpCwd('warm:\n  enabled: false\n');
    const cfg = loadConfig(cwd);
    expect(cfg.warm.enabled).toBe(false);
    // unspecified fields fall back to defaults
    expect(cfg.warm.intervalSeconds).toBe(3000);
    expect(cfg.warm.excludeModels).toEqual([]);
  });

  it('lets a project-level config override interval and excludeModels', () => {
    const cwd = makeTmpCwd('warm:\n  intervalSeconds: 1800\n  excludeModels: ["claude-fable-5"]\n');
    const cfg = loadConfig(cwd);
    expect(cfg.warm).toEqual({
      enabled: true,
      intervalSeconds: 1800,
      excludeModels: ['claude-fable-5'],
    });
  });

  it('project config overrides user config', () => {
    fs.mkdirSync(path.join(fakeHome, '.claude'));
    fs.writeFileSync(
      path.join(fakeHome, '.claude', 'cache-control.yaml'),
      'warm:\n  enabled: false\n  intervalSeconds: 600\n',
    );
    const cwd = makeTmpCwd('warm:\n  enabled: true\n');
    const cfg = loadConfig(cwd);
    expect(cfg.warm.enabled).toBe(true);
    // user-level intervalSeconds survives since project didn't override it
    expect(cfg.warm.intervalSeconds).toBe(600);
  });
});

describe('cronForDelay', () => {
  it('returns a 5-field local-time cron ending in *', () => {
    const cron = cronForDelay(3000);
    const parts = cron.split(' ');
    expect(parts).toHaveLength(5);
    expect(parts[4]).toBe('*');
    const [min, hour, dom, mon] = parts.map(Number);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(min).toBeLessThanOrEqual(59);
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThanOrEqual(23);
    expect(dom).toBeGreaterThanOrEqual(1);
    expect(dom).toBeLessThanOrEqual(31);
    expect(mon).toBeGreaterThanOrEqual(1);
    expect(mon).toBeLessThanOrEqual(12);
  });
});

describe('session-start-hook output', () => {
  const hookPath = path.resolve(__dirname, '..', '..', 'dist', 'session-start-hook.cjs');
  const built = fs.existsSync(hookPath);

  it.skipIf(!built)('emits the CronCreate-based warm protocol when warm is enabled', () => {
    const cwd = makeTmpCwd();
    const result = spawnSync('node', [hookPath], {
      input: JSON.stringify({ hook_event_name: 'SessionStart', cwd, session_id: 's1' }),
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('__cache-warm-ping__');
    // Initial arm is a non-terminating CronCreate; re-arm on a fired ping is ScheduleWakeup.
    expect(result.stdout).toContain('CronCreate');
    expect(result.stdout).toContain('ScheduleWakeup');
    const parsed = JSON.parse(result.stdout);
    expect(parsed.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(typeof parsed.hookSpecificOutput.additionalContext).toBe('string');
  });

  it.skipIf(!built)('emits nothing when warm is disabled', () => {
    const cwd = makeTmpCwd('warm:\n  enabled: false\n');
    const result = spawnSync('node', [hookPath], {
      input: JSON.stringify({ hook_event_name: 'SessionStart', cwd, session_id: 's1' }),
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});

describe('prompt-hook short-circuit on ping', () => {
  const hookPath = path.resolve(__dirname, '..', '..', 'dist', 'prompt-hook.cjs');
  const built = fs.existsSync(hookPath);

  it.skipIf(!built)('silently allows the warm-ping sentinel', () => {
    const result = spawnSync('node', [hookPath], {
      input: JSON.stringify({
        hook_event_name: 'UserPromptSubmit',
        session_id: 's-ping',
        cwd: process.cwd(),
        message: '__cache-warm-ping__',
      }),
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});
