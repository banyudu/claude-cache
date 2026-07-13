---
name: warm
description: View or toggle auto-warming of the prompt cache
---

Auto-warming keeps the Anthropic prompt cache TTL refreshed during idle gaps so the next prompt is a cache hit instead of an expensive rebuild.

How it works:
- The plugin's `SessionStart` hook injects an instruction telling you (the assistant) to arm the warm timer once by calling `CronCreate` (non-turn-terminating, so it runs alongside your reply without ending it). No `Stop` hook is used, so nothing is injected after replies.
- Each warm job is a one-shot cron ~`intervalSeconds` ahead. When it fires, the sentinel `__cache-warm-ping__` arrives as a user message; you reply `ok` and re-arm the next cycle via `ScheduleWakeup`. Real turns already refresh the cache.
- Jobs are session-only — they die when the session ends.

Configuration lives in `cache-control.yaml` under the `warm` key:

```yaml
warm:
  enabled: true            # set to false to disable globally for this scope
  intervalSeconds: 3000    # ~50 min — stay inside the 1h cache TTL
  excludeModels: []        # optional: skip warming when the model id contains any entry
```

Config layers (highest priority first):
1. Project — `.claude/cache-control.yaml`
2. User — `~/.claude/cache-control.yaml`
3. Built-in defaults (warming enabled)

Usage in this session:
- `/warm off` — stop warming for the rest of this session. Cancel any pending warm job with `CronDelete`, and do not arm or re-arm again.
- `/warm on` — arm the warm timer now via `CronCreate` and resume re-arming on each ping.
- `/warm` (no args) — report the current state: whether warming is on, the configured interval, and whether a warm job is pending.

To make a change persistent across sessions, edit `cache-control.yaml` directly (or ask the user where to put it). Do not edit on the user's behalf without confirming the scope (project vs user).
