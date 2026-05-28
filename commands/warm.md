---
name: warm
description: View or toggle auto-warming of the prompt cache
---

Auto-warming keeps the Anthropic prompt cache TTL refreshed during idle gaps so the next prompt is a cache hit instead of an expensive rebuild.

How it works:
- The plugin's `SessionStart` hook injects an instruction telling you (the assistant) to re-arm a `ScheduleWakeup` timer at the end of every reply.
- Each re-arm replaces the previous pending wakeup. While the user is actively chatting, the timer never fires — real turns already refresh the cache.
- If the session goes silent for the configured interval (~50 min by default, inside the 1h extended cache TTL), the wakeup fires with the sentinel `__cache-warm-ping__`, you reply `ok`, re-arm, and the cache stays warm.

Configuration lives in `cache-control.yaml` under the `warm` key:

```yaml
warm:
  enabled: true            # set to false to disable globally for this scope
  intervalSeconds: 3000    # ~50 min — stay inside the 1h cache TTL
  maxIdleHours: 5          # stop after N hours of consecutive idle; any real user turn resets
```

Config layers (highest priority first):
1. Project — `.claude/cache-control.yaml`
2. User — `~/.claude/cache-control.yaml`
3. Built-in defaults (warming enabled)

Usage in this session:
- `/warm off` — read the user's intent and stop re-arming the wakeup for the rest of the session. Do not call `ScheduleWakeup` again.
- `/warm on` — resume re-arming on the next reply.
- `/warm` (no args) — report the current state: whether you are still re-arming, the configured interval, and roughly how long this session has been warmed.

To make a change persistent across sessions, edit `cache-control.yaml` directly (or ask the user where to put it). Do not edit on the user's behalf without confirming the scope (project vs user).
