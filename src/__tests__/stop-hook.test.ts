import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  WARM_PING_SENTINEL,
  maxConsecutivePings,
  modelExcluded,
  hasPendingWarmCron,
  countTrailingPings,
  currentModel,
  readTailObjects,
  buildArmInstruction,
} from '../warm';

const userReal = (text: string) => ({ type: 'user', message: { role: 'user', content: text } });
const ping = () => ({
  type: 'user',
  message: { role: 'user', content: WARM_PING_SENTINEL },
  promptSource: 'system',
  isMeta: true,
});
const toolResult = () => ({
  type: 'user',
  message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] },
});
const assistant = (model = 'claude-opus-4-8') => ({
  type: 'assistant',
  message: { role: 'assistant', model, content: [{ type: 'text', text: 'hi' }] },
});

describe('warm helpers', () => {
  it('maxConsecutivePings floors the idle budget', () => {
    expect(maxConsecutivePings(3000, 5)).toBe(6);
    expect(maxConsecutivePings(1800, 6)).toBe(12);
    expect(maxConsecutivePings(3600, 0)).toBe(1); // never below 1
  });

  it('modelExcluded does case-insensitive substring matching', () => {
    expect(modelExcluded('claude-fable-5', ['fable'])).toBe(true);
    expect(modelExcluded('claude-FABLE-5', ['fable'])).toBe(true);
    expect(modelExcluded('claude-opus-4-8', ['fable'])).toBe(false);
    expect(modelExcluded('claude-fable-5', [])).toBe(false);
    expect(modelExcluded('', ['fable'])).toBe(false);
  });

  it('hasPendingWarmCron detects our sentinel cron', () => {
    expect(hasPendingWarmCron([{ prompt: WARM_PING_SENTINEL }])).toBe(true);
    expect(hasPendingWarmCron([{ prompt: 'other' }])).toBe(false);
    expect(hasPendingWarmCron([])).toBe(false);
    expect(hasPendingWarmCron(undefined)).toBe(false);
  });

  it('countTrailingPings counts trailing pings, skips tool_results, stops at a real turn', () => {
    expect(countTrailingPings([userReal('hi'), assistant(), ping(), assistant(), ping(), assistant()])).toBe(2);
    // tool_result between pings must not reset the count
    expect(countTrailingPings([userReal('hi'), assistant(), ping(), toolResult(), ping()])).toBe(2);
    // a real human message resets to 0 from the end
    expect(countTrailingPings([ping(), ping(), userReal('real'), assistant()])).toBe(0);
    expect(countTrailingPings([])).toBe(0);
  });

  it('currentModel returns the most recent assistant model', () => {
    expect(currentModel([assistant('claude-opus-4-8'), userReal('x'), assistant('claude-fable-5')])).toBe(
      'claude-fable-5',
    );
    expect(currentModel([userReal('x')])).toBe('');
  });

  it('readTailObjects parses a JSONL transcript', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-warm-tr-'));
    const file = path.join(dir, 't.jsonl');
    fs.writeFileSync(file, [userReal('hi'), assistant(), ping()].map((o) => JSON.stringify(o)).join('\n') + '\n');
    const objs = readTailObjects(file);
    expect(objs.length).toBe(3);
    expect(countTrailingPings(objs)).toBe(1);
    expect(readTailObjects(path.join(dir, 'missing.jsonl'))).toEqual([]);
  });

  it('buildArmInstruction embeds the interval, sentinel, and ScheduleWakeup', () => {
    const text = buildArmInstruction(3000);
    expect(text).toContain('ScheduleWakeup');
    expect(text).toContain(WARM_PING_SENTINEL);
    expect(text).toContain('3000');
  });
});

describe('stop-hook output', () => {
  const hookPath = path.resolve(__dirname, '..', '..', 'dist', 'stop-hook.cjs');
  const built = fs.existsSync(hookPath);

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

  function tmpCwd(yaml?: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-warm-cwd-'));
    if (yaml != null) {
      fs.mkdirSync(path.join(dir, '.claude'));
      fs.writeFileSync(path.join(dir, '.claude', 'cache-control.yaml'), yaml);
    }
    return dir;
  }

  function writeTranscript(cwd: string, lines: object[]): string {
    const file = path.join(cwd, 'transcript.jsonl');
    fs.writeFileSync(file, lines.map((o) => JSON.stringify(o)).join('\n') + '\n');
    return file;
  }

  function run(payload: object) {
    return spawnSync('node', [hookPath], {
      input: JSON.stringify({ hook_event_name: 'Stop', ...payload }),
      encoding: 'utf-8',
    });
  }

  it.skipIf(!built)('arms after a normal reply (no pending cron)', () => {
    const cwd = tmpCwd();
    const transcript_path = writeTranscript(cwd, [userReal('hi'), assistant()]);
    const result = run({ stop_hook_active: false, cwd, transcript_path, session_crons: [] });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.hookSpecificOutput.hookEventName).toBe('Stop');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('ScheduleWakeup');
    expect(parsed.hookSpecificOutput.additionalContext).toContain(WARM_PING_SENTINEL);
  });

  it.skipIf(!built)('stays silent inside the arming continuation (stop_hook_active)', () => {
    const cwd = tmpCwd();
    const result = run({ stop_hook_active: true, cwd, session_crons: [] });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it.skipIf(!built)('does not re-arm when a warm cron is already pending', () => {
    const cwd = tmpCwd();
    const transcript_path = writeTranscript(cwd, [userReal('hi'), assistant()]);
    const result = run({
      stop_hook_active: false,
      cwd,
      transcript_path,
      session_crons: [{ prompt: WARM_PING_SENTINEL }],
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it.skipIf(!built)('re-arms every turn when rearmEveryTurn is true (ignores pending cron)', () => {
    const cwd = tmpCwd('warm:\n  rearmEveryTurn: true\n');
    const transcript_path = writeTranscript(cwd, [userReal('hi'), assistant()]);
    const result = run({
      stop_hook_active: false,
      cwd,
      transcript_path,
      session_crons: [{ prompt: WARM_PING_SENTINEL }],
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ScheduleWakeup');
  });

  it.skipIf(!built)('stops arming once the idle cap is reached', () => {
    const cwd = tmpCwd();
    // default interval 3000 / maxIdleHours 5 => cap 6; supply 6 trailing pings
    const lines: object[] = [userReal('hi'), assistant()];
    for (let i = 0; i < 6; i++) {
      lines.push(ping(), assistant());
    }
    const transcript_path = writeTranscript(cwd, lines);
    const result = run({ stop_hook_active: false, cwd, transcript_path, session_crons: [] });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it.skipIf(!built)('honours excludeModels from the live transcript model', () => {
    const cwd = tmpCwd('warm:\n  excludeModels:\n    - fable\n');
    const transcript_path = writeTranscript(cwd, [userReal('hi'), assistant('claude-fable-5')]);
    const result = run({ stop_hook_active: false, cwd, transcript_path, session_crons: [] });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it.skipIf(!built)('stays silent when warming is disabled', () => {
    const cwd = tmpCwd('warm:\n  enabled: false\n');
    const result = run({ stop_hook_active: false, cwd, session_crons: [] });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});
