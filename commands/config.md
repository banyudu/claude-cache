---
name: config
description: View or edit cache-control thresholds
---

Show the current cache-control configuration. The config is loaded from these locations (in order of priority):

1. Project-level: `.claude/cache-control.yaml` in the current working directory
2. User-level: `~/.claude/cache-control.yaml`
3. Built-in defaults

Default thresholds:
- `warnTokens: 40000` (~160KB) — ask before proceeding
- `blockTokens: 400000` (~1.6MB) — deny the operation
- `warnCumulativeTokens: 500000` — warn on all subsequent ops
- `protectClaudeMd: true` — always ask before modifying CLAUDE.md

To customize, create `.claude/cache-control.yaml`:

```yaml
thresholds:
  warnTokens: 80000
  blockTokens: 800000
  warnCumulativeTokens: 1000000
protectClaudeMd: true
tools:
  Read:
    warnTokens: 100000
  Write:
    warnTokens: 20000
```
