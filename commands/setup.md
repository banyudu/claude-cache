---
name: setup
description: Configure the prompt-submit hook for prompt-level cache monitoring
---

To enable prompt-level cache monitoring, add the following to your `~/.claude/settings.json`:

```json
{
  "user-prompt-submit-hook": "node /path/to/claude-cache-control/dist/prompt-hook.cjs"
}
```

Replace `/path/to/claude-cache-control` with the actual path to this plugin's installation directory.

This hook will:
- Warn when you're about to send a very large prompt (>40K tokens)
- Warn when your session's cumulative token usage is approaching the threshold
- Suggest starting a new conversation to reduce cache rebuild costs
