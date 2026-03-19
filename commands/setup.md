---
name: setup
description: Show setup status for cache-control plugin
---

The cache-control plugin is fully configured via the plugin's `hooks.json`. No manual setup is required.

Both hooks are automatically registered when the plugin is enabled:
- **PreToolUse** — intercepts Read, Write, Edit, and Bash tool calls to estimate cache impact
- **UserPromptSubmit** — warns when prompts are very large or session cumulative usage is high

To customize thresholds, create a config file:
- **User-level**: `~/.claude/cache-control.yaml`
- **Project-level**: `.claude/cache-control.yaml`

See `/config` for configuration options.
