# Feedback Copilot

Voice-driven product review sessions for [Claude Code](https://claude.ai/download). Opens a browser panel overlaid on your app, walks you through each page, listens to voice feedback via speech recognition, logs structured items, and then fixes everything.

## Install

In Claude Code, run:

```
/install-plugin github:metamellow/claude-feedback-copilot
```

Or use the Desktop app: **Settings > Plugins > Add marketplace from GitHub** and enter `metamellow/claude-feedback-copilot`.

The first run auto-installs npm dependencies (~10 seconds).

## Usage

Open any project in Claude Code and run:

```
/feedback-copilot:review
```

Claude will:

1. **Detect your dev server** (Vite, Next.js, Nuxt, Angular, or the built-in test page)
2. **Start the bridge server** and inject a floating overlay panel into your app
3. **Walk through each page**, speaking context via text-to-speech
4. **Listen to your voice feedback** via the Web Speech API
5. **Log structured items** (category, severity, description) for each page
6. **Fix every issue** in your codebase after the review wraps up

### Browser Integration

For the best experience, install the [Claude in Chrome](https://chromewebstore.google.com/detail/claude-in-chrome/) extension. This lets Claude:

- Automatically open your app in a new tab
- Inject the overlay without any manual steps
- Navigate between pages during the review

**Without the extension**: Claude will give you a console snippet to paste into your browser's DevTools. Everything else works the same.

### Drawing Mode

During a review, you can circle or annotate areas on screen:

1. Click the **Draw** button in the panel (or Claude will offer it when relevant)
2. Draw freehand on the canvas overlay
3. Click **Done Drawing** or press **Escape**
4. The drawing is captured and sent to Claude as context

### Voice Controls

- **Spacebar**: Toggle microphone on/off
- **Click the mic button**: Hold-to-talk or click-to-toggle
- **Next Page / Wrap Up**: Buttons in the panel footer

## Built-in Test Page

No project? No problem. If Claude doesn't detect a dev server, it offers a built-in demo page at `http://localhost:3847/test`. This lets you test the full flow (overlay, TTS, speech recognition, drawing, feedback logging) without any external project.

## MCP Tools

The plugin exposes 10 tools via the Model Context Protocol:

| Tool | Description |
|------|-------------|
| `start_review_session` | Start bridge server, return injection scripts |
| `speak` | Text-to-speech message to user |
| `listen` | Activate mic, wait for speech transcription |
| `log_feedback` | Log structured feedback item |
| `update_panel_state` | Update panel display (page, progress) |
| `get_review_summary` | Get all logged feedback |
| `end_review_session` | Close session, stop bridge |
| `request_drawing` | Ask user to annotate the screen |
| `hide_overlay` | Hide overlay (for clean screenshots) |
| `show_overlay` | Show overlay again |

## Requirements

- Node.js 18+
- Claude Code with plugin support
- Chrome browser (for speech recognition and overlay)
- [Claude in Chrome](https://chromewebstore.google.com/detail/claude-in-chrome/) extension (recommended, not required)

## Uninstall

```
/plugin uninstall feedback-copilot
```

Kill any lingering processes: `npx kill-port 3847`

## License

MIT
