# Claude Feedback Copilot

Voice-driven product review sessions for Claude Code. Talk through your app
with Claude as your design partner, then let it fix everything.

## Install

```
/plugin install github:metamellow/claude-feedback-copilot
```

That's it. No manual config, no file copying.

## Use

In Claude Code, type:

> /feedback-copilot:review

Claude will:
1. Detect your dev server and start it if needed
2. Analyze your routes and prioritize pages to review
3. Walk you through each page with voice — you talk, it listens
4. Log structured feedback (bugs, visual issues, UX problems)
5. Fix everything it logged when you're done

## Requirements

- Claude Code
- Chrome or Edge (for speech recognition)
- Node.js 18+

No API keys. No config. Everything runs locally.

## Uninstall

```
/plugin uninstall feedback-copilot
```
