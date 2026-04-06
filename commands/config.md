---
name: config
description: View or edit cache-control thresholds
---

Show the current cache-control configuration. The config is loaded from these locations (in order of priority):

1. Project-level: `.claude/cache-control.yaml` in the current working directory
2. User-level: `~/.claude/cache-control.yaml`
3. Built-in defaults

Default thresholds (percentage of `contextSize`):
- `contextSize: 200000` — context window size in tokens (Sonnet/Opus: 200000, 1M variants: 1000000)
- `warnTokens: "20%"` — ask before proceeding
- `blockTokens: "50%"` — deny the operation
- `warnCumulativeTokens: "100%"` — warn on all subsequent ops
- `protectClaudeMd: true` — always ask before modifying CLAUDE.md

Thresholds support both fixed token counts and percentages of `contextSize`:

```yaml
# For Opus-1M with 1M context window
contextSize: 1000000
thresholds:
  warnTokens: "20%"       # = 200,000 tokens
  blockTokens: "50%"      # = 500,000 tokens
  warnCumulativeTokens: "100%"
protectClaudeMd: true
tools:
  Read:
    warnTokens: "30%"
  Write:
    warnTokens: 20000      # fixed count also works
```
