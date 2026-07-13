# Claude Cache

Cache-aware cost guard for [Claude Code](https://claude.ai/code). Intercepts tool calls that may cause expensive prompt cache invalidation — warns or blocks operations that read/write large files, protecting your token budget.

## The problem

Claude Code's prompt caching saves significant costs by reusing previously cached context. But certain operations silently invalidate the cache:

- **Reading large files** pushes the context window, evicting cached content
- **Writing or editing files** that are already in context forces a cache miss on the next turn
- **Large prompts** increase the chance of cache displacement

Without visibility into these costs, a single `Read` of a 100KB file can silently waste thousands of cached tokens — turning a cheap conversation into an expensive one.

## How Cache Control solves it

Cache Control hooks into Claude Code's `PreToolUse` and `UserPromptSubmit` events to **estimate the token impact** of every file operation before it happens.

- **PreToolUse** — intercepts `Read`, `Write`, `Edit`, and `Bash` tool calls to estimate cache impact based on file size
- **UserPromptSubmit** — warns when prompts are very large or session cumulative usage is high
- **Cumulative tracking** — tracks total token impact across the session, escalating warnings as costs accumulate
- **CLAUDE.md protection** — always prompts before modifying CLAUDE.md files, which anchor the prompt cache

The result: **visibility into cache costs before they happen**, with configurable thresholds to warn or block expensive operations.

## Install

Two commands inside Claude Code:

```
/plugin marketplace install banyudu/claude-cache
/plugin install cache@claude-cache
```

That's it. Restart Claude Code and Cache Control is active.

### Alternative: install from npm

```bash
npm install -g claude-cache
claude --plugin-dir $(npm root -g)/claude-cache
```

### Alternative: test locally from source

```bash
git clone https://github.com/banyudu/claude-cache.git
cd claude-cache && pnpm install && pnpm run build
claude --plugin-dir ./claude-cache
```

## Configure

Cache Control works out of the box with sensible defaults. To customize, create a config file:

- **User-level** (applies everywhere): `~/.claude/cache-control.yaml`
- **Project-level** (overrides user-level): `.claude/cache-control.yaml`

### Config priority

Config is evaluated in layers with **project > user > default** priority:

1. **Project-level** (`.claude/cache-control.yaml`) — highest priority
2. **User-level** (`~/.claude/cache-control.yaml`)
3. **Built-in defaults**

### Default thresholds

Thresholds can be **fixed token counts** or **percentages of `contextSize`**.

| Setting | Default | Description |
|---------|---------|-------------|
| `contextSize` | 200,000 | Context window size (Sonnet/Opus: 200000, 1M variants: 1000000) |
| `warnTokens` | `"20%"` | Ask before proceeding |
| `blockTokens` | `"50%"` | Deny the operation |
| `warnCumulativeTokens` | `"100%"` | Warn on all subsequent ops |
| `protectClaudeMd` | `true` | Always ask before modifying CLAUDE.md |

### Config example

```yaml
# For Opus-1M / Sonnet-1M
contextSize: 1000000
thresholds:
  warnTokens: "20%"        # 200,000 tokens
  blockTokens: "50%"       # 500,000 tokens
  warnCumulativeTokens: "100%"
protectClaudeMd: true
tools:
  Read:
    warnTokens: "30%"
  Write:
    warnTokens: 20000       # fixed count also works
```

## Auto-warm the cache during idle gaps

Long idle periods inside an active session let the Anthropic prompt cache expire — so when you finally come back, the next prompt pays for a full cache rebuild. Cache Control auto-prevents this:

- A `SessionStart` hook injects a one-time instruction: arm the warm timer by calling `CronCreate` (a **non-turn-terminating** tool) alongside your first reply. Because `CronCreate` doesn't end the turn, the arm runs inside the reply without swallowing the answer — model-agnostic, and safe even for fast models like Fable. **No `Stop` hook is used, so nothing is injected after any reply — there is no per-turn message.**
- If the session goes silent past the configured interval (~50 min by default, inside the 1h extended cache TTL), the one-shot cron fires with the sentinel `__cache-warm-ping__`; the assistant replies `ok` and re-arms via `ScheduleWakeup`, so the cache stays warm.
- Warm jobs are session-only — they die when the session ends, so an abandoned session stops warming on its own. There is deliberately no idle-hours cap; if you want to stop warming a long-idle-but-open session, run `/warm off`.

Arming relies on the assistant acting on the SessionStart instruction during its first turn. If it ever doesn't arm, the next `SessionStart` (resume / `/clear` / compact) re-injects the instruction and re-arms.

Enabled by default. To disable, set `warm.enabled: false` in `cache-control.yaml`, or say `/warm off` mid-session.

```yaml
warm:
  enabled: true
  intervalSeconds: 3000    # ~50 min — stay inside the 1h extended cache TTL
  excludeModels: []        # optional: skip warming when the model id contains any entry, e.g. ["fable"]
```

## Slash commands

| Command | Description |
|---------|-------------|
| `/setup` | Show setup status |
| `/config` | View or edit thresholds |
| `/status` | Show session cache impact stats |
| `/reset` | Reset session tracking data |
| `/warm` | View or toggle auto-warming |

## License

MIT
