# Claude Feedback Copilot

Voice-driven product review sessions for Claude Code. An MCP server that opens a browser panel, talks the user through their app page by page, listens via speech recognition, logs structured feedback, and then fixes everything.

---

## Test Build Notes

The following issues were discovered and fixed during the test build. These notes are critical for the real build.

### Bug Fixes

1. **MCP SDK API**: The `Server` class and string-based handlers (`server.setRequestHandler('tools/list', ...)`) are deprecated in SDK v1.26.0. Use `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` with `registerTool()` and Zod input schemas instead.

2. **`open` package removed**: Originally used to auto-open the bookmarklet page. Removed entirely — the server no longer auto-opens anything. The `open` package (ESM-only) is no longer a dependency. The slash command (`review.md`) now instructs Claude to tell the user what to do via text.

3. **Zod dependency**: The MCP SDK depends on Zod transitively, but we use it directly for tool schemas. Add `zod@^3.25.0` to `package.json` dependencies explicitly.

4. **Naming**: Everything uses "claude-feedback-copilot" / "feedback-copilot" / "Feedback Copilot". The old name "claude-review-pilot" is retired.

5. **CLI init**: Uses `claude mcp add` command for auto-registration (zero-config). Falls back to printing the command if auto-registration fails. Does NOT manually write to MCP config files (paths vary by OS and are fragile).

6. **XSS protection**: The panel's `renderLog()` method uses `innerHTML` with user-provided content. Added `escapeHtml()` method to sanitize all dynamic text before insertion.

7. **Mixed content blocking**: The bookmarklet injects an HTTP script (`localhost:PORT/overlay.js`). This is blocked on HTTPS pages by Chrome's mixed content policy. This is fine — the target use case is localhost dev apps (HTTP). For HTTPS apps, users can paste the console snippet directly or use the panel in a separate tab.

8. **Stdio/WS timing — `speak` blocks forever**: The MCP server runs on stdio (spawned by Claude Code), and starts an Express+WS bridge internally. When Claude calls `speak` immediately after `start_review_session`, the browser panel hasn't connected yet (the `open()` call opens a bookmarklet instruction page, NOT the panel directly). The `speak` handler blocks on `waitForEvent('user_speech')` which never resolves. Fix: (a) `speak` handler checks `bridge.connection.isConnected()` — if not connected, returns immediately with `status: 'panel_not_connected'` and instructions for Claude to guide the user. (b) `start_review_session` return includes a `next_step` field telling Claude to guide user via text (not speak) to inject the overlay. (c) `review.md` slash command adds steps 4-5 between `start_review_session` and the first `speak` call: tell user to inject overlay, wait for confirmation.

9. **Slash command path**: Commands at `.claude/commands/review.md` become `/review` (NOT `/project:review`). The `/project:` prefix does not exist.

10. **MCP registration on Windows**: `claude mcp add` may run silently without persisting on Windows. The most reliable approach is creating a `.mcp.json` file in the project root with the `mcpServers` config. This triggers Claude Code's project-scope MCP approval dialog on first use.

### Architecture Notes

- **MCP SDK CJS support**: Despite `"type": "module"` in its package.json, the SDK provides CJS builds via exports map (`"require": "./dist/cjs/..."`). Our project uses CommonJS throughout.
- **Tool input schemas**: `McpServer.registerTool()` accepts a Zod shape object (key-value pairs of Zod types), NOT a `z.object()` wrapper. McpServer wraps it internally.
- **Port conflicts**: Bridge server attempts port 3847 first. On `EADDRINUSE`, it increments and retries. Use `npx kill-port 3847` if a stale process holds the port.
- **No auto-open**: The bridge server does NOT open any browser pages. The `start_review_session` return includes `bookmarklet_url` and `console_snippet` — the slash command prompt instructs Claude to relay these to the user via text.
- **Dev server auto-start**: Handled entirely in `review.md` (prompt engineering, not code). Step 0 instructs Claude to read `package.json` scripts, check framework configs for port overrides (Vite, Next, Nuxt, Angular), run `npm run dev` in the background if not already running, and parse the port from output. No MCP server code needed — Claude already has terminal and file-reading capabilities.
- **`console_snippet` field**: `start_review_session` returns a paste-able JS snippet that injects the overlay. This is the fallback for users who don't have the bookmarklet saved.

---

## Project Structure (Plugin Format)

This project is a **Claude Code plugin**. It uses the native plugin system for zero-config installation. No manual MCP registration or file copying needed.

```
claude-feedback-copilot/
├── .claude-plugin/
│   └── plugin.json             # Plugin manifest (name, version, description)
├── .mcp.json                   # MCP server config (auto-registered on install)
├── package.json
├── .gitignore
├── src/
│   ├── mcp/
│   │   ├── index.js            # MCP server entry point (McpServer + registerTool)
│   │   ├── tools.js            # Tool definitions (Zod schemas, 10 tools)
│   │   └── handlers.js         # Tool execution logic
│   ├── bridge/
│   │   ├── server.js           # Express + WebSocket server + overlay routes
│   │   └── connection.js       # WS connection manager
│   ├── session/
│   │   ├── state.js            # Session state machine
│   │   └── review-log.js       # Structured review log
│   └── panel/
│       ├── index.html          # Panel UI (with draw button)
│       ├── styles.css          # Styles (with overlay mode + draw styles)
│       ├── app.js              # Panel client (with overlay detection, draw mode, postMessage)
│       └── overlay.js          # Bookmarklet payload (floating iframe + drawing canvas)
├── commands/
│   └── review.md               # Slash command → /feedback-copilot:review
└── README.md
```

### Plugin System Notes

- `.claude-plugin/plugin.json` — only manifest fields, no code
- `.mcp.json` — uses `${CLAUDE_PLUGIN_ROOT}` for portable paths
- `commands/review.md` — auto-discovered as `/feedback-copilot:review` (namespaced)
- **No `bin/cli.js`** — the plugin system replaces the old `feedback-copilot init` command entirely
- **No manual file copying** — users install with `/plugin install` and everything registers automatically
- **No `.mcp.json` in target projects** — the plugin's `.mcp.json` is scoped to the plugin, not injected into user projects

---

## Dependencies

```json
{
  "name": "claude-feedback-copilot",
  "version": "1.0.0",
  "description": "Voice-driven product review sessions for Claude Code",
  "main": "src/mcp/index.js",
  "scripts": {
    "start": "node src/mcp/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0",
    "express": "^4.18.0",
    "ws": "^8.16.0",
    "zod": "^3.25.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

Key dependency notes:
- `@modelcontextprotocol/sdk@^1.26.0` — uses `McpServer` + `registerTool()` API
- `zod@^3.25.0` — used directly for tool input schemas (also a transitive dep of SDK)
- **No `open` package** — server does not auto-open any pages; orchestration is in review.md
- **No `bin` entry** — plugin system replaces the CLI `init` command

---

## MCP Tools (10 total)

| Tool | Description |
|------|-------------|
| `start_review_session` | Starts session. Returns `panel_url`, `bookmarklet_url`, `console_snippet`. |
| `speak` | TTS message to user. `await_response: true` auto-listens after. |
| `listen` | Activate mic, wait for user speech. |
| `log_feedback` | Log structured feedback (page, category, severity, description). |
| `update_panel_state` | Update panel display (progress, status). |
| `get_review_summary` | Get full review log for fix phase. |
| `end_review_session` | Close session and panel. |
| `request_drawing` | Ask user to draw on screen. Returns base64 PNG. |
| `hide_overlay` | Hide floating overlay (for screenshots). |
| `show_overlay` | Show floating overlay again. |

---

## Architecture: Overlay Mode

The panel can run as a floating iframe overlay on the user's app page (instead of a separate tab).

### How it works

1. `start_review_session` starts the bridge server (no page auto-opens). Claude tells the user to open their app and inject the overlay.
2. User navigates to their app and either clicks the saved bookmarklet or pastes the console snippet
3. The bookmarklet injects a `<script>` tag loading `/overlay.js` from the bridge server
4. `overlay.js` creates:
   - A floating `<iframe>` pointing to `localhost:PORT/?overlay=true` (the panel in compact mode)
   - A full-viewport transparent `<canvas>` for freehand drawing
   - A drag handle, minimize/expand toggle, and floating "Done Drawing" button
5. The panel detects `?overlay=true` and applies compact CSS (smaller padding, buttons, constrained log)
6. Communication between iframe and host page uses `postMessage`

### Drawing data flow

```
Claude calls request_drawing tool
  → handlers.js sends 'request_drawing' via WS
  → panel app.js receives, calls startDrawMode()
  → panel sends postMessage {type:'fc-start-drawing'} to parent
  → overlay.js (host page) activates canvas (pointer-events: auto, crosshair cursor)
  → user draws freehand (red #ff3b30, 3px lines)
  → user clicks Done / presses Escape
  → overlay.js captures canvas.toDataURL('image/png')
  → overlay.js sends postMessage {type:'fc-drawing-complete', imageData} to iframe
  → panel app.js receives, sends 'drawing_complete' via WS
  → handlers.js resolves waitForEvent, returns base64 image to Claude
```

### Key technical notes

- **iframe mic access**: Requires `allow="microphone"` attribute on iframe AND `Permissions-Policy: microphone=(self)` header
- **Bookmarklet approach**: Script tag loader (~100 chars) avoids bookmarklet length limits
- **Port injection**: `/overlay.js` route reads the file and replaces `__PORT__` with the actual port
- **Drawing size**: Full viewport canvas with freehand lines = typically 5-20KB PNG (mostly transparent)
- **Mixed content**: HTTP script won't load on HTTPS pages. Target use case is localhost (HTTP).

---

## File-by-File Implementation Guide

### `src/mcp/index.js`

Uses `McpServer` (not deprecated `Server`). Registers all tools from `tools.js` with Zod schemas. Connects via `StdioServerTransport`.

```javascript
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
```

Loop pattern:
```javascript
for (const [name, def] of Object.entries(toolDefinitions)) {
  server.registerTool(name, {
    description: def.description,
    inputSchema: def.inputSchema, // Zod shape object, NOT z.object()
  }, async (args) => {
    const result = await handleToolCall(name, args);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });
}
```

### `src/mcp/tools.js`

Each tool is a `{ description, inputSchema }` where `inputSchema` is a Zod shape (key-value pairs). Example:

```javascript
const z = require('zod');

const toolDefinitions = {
  speak: {
    description: 'Say something to the user...',
    inputSchema: {
      message: z.string().describe('What to say'),
      await_response: z.boolean().optional().default(true).describe('...'),
    },
  },
  // ... 10 tools total
};
```

### `src/mcp/handlers.js`

Singleton `bridge`, `session`, `reviewLog`. Notable handlers:

- `start_review_session`: Creates bridge, returns `{ panel_url, bookmarklet_url, console_snippet, next_step }` — the `next_step` tells Claude to guide user through overlay setup via text before calling `speak`
- `speak`: **Checks `bridge.connection.isConnected()` first** — if panel not connected, returns `{ status: 'panel_not_connected', instructions }` immediately instead of blocking. Only sends TTS over WS when connected.
- `request_drawing`: Sends `request_drawing` event, waits for `drawing_complete`, returns base64 image
- `hide_overlay` / `show_overlay`: Send events to panel which forwards to host via postMessage

### `src/bridge/server.js`

Express server with:
- CORS middleware + `Permissions-Policy: microphone=(self)` header
- `GET /overlay.js` — reads `overlay.js`, replaces `__PORT__`, serves as JS
- `GET /bookmarklet` — HTML page with bookmarklet link + console paste fallback
- Static file serving for the panel
- WebSocket server for real-time communication
- Does NOT auto-open any page. The `open` package was removed. Bookmarklet URL is returned in the MCP response for Claude to relay to the user.

### `src/bridge/connection.js`

WebSocket connection manager with:
- `register(ws)` — sets up message handler, resolves pending promises by event name
- `send(payload)` — JSON serialize and send
- `waitForEvent(name, timeout)` — returns Promise, rejects on timeout
- `close()` — closes WS and clears all pending resolvers

### `src/panel/overlay.js`

Bookmarklet payload (runs in HOST page context). Creates:
- `#fc-overlay-root` — floating container with drag handle, minimize toggle, iframe
- `#fc-draw-canvas` — full-viewport transparent canvas for freehand drawing
- Floating "Done Drawing" button as fallback

postMessage bridge handles: `fc-start-drawing`, `fc-stop-drawing`, `fc-clear-drawing`, `fc-hide-overlay`, `fc-show-overlay`

Drawing: mouse + touch events, red lines (#ff3b30), 3px, round caps/joins. Escape key finishes drawing.

### `src/panel/index.html`

Panel HTML with draw button (pencil SVG icon) and draw-status bar (Done/Clear buttons, hidden by default) in the voice section.

### `src/panel/styles.css`

Includes:
- Base panel styles (header, message bubble, voice section, review log, footer)
- `.draw-btn` styles (idle, hover, active/recording states)
- `.draw-status` bar styles
- `body.overlay` overrides — compact layout for iframe mode (smaller padding, smaller buttons, transparent bg, constrained 180px log)

### `src/panel/app.js`

Panel client with:
- Overlay detection via `?overlay=true` URL param → adds `overlay` class to body
- `setupOverlayMessaging()` — listens for `fc-drawing-complete` postMessage
- `forwardToHost(type)` — sends postMessage to parent window
- Draw mode: `startDrawMode()`, `stopDrawMode()`, `clearDrawing()`, `onDrawingComplete()`, `onRequestDrawing()`
- Event handling for `request_drawing`, `hide_overlay`, `show_overlay`
- `escapeHtml()` for XSS protection in log rendering

### `commands/review.md`

The "brain" — slash command prompt that instructs Claude how to conduct review sessions. Includes:
- Role definition (senior product reviewer / design partner)
- Session flow (**detect dev server + port** → auto-run if needed → analyze routes → prioritize → start session → **text-based panel setup** → wait for user confirmation → speak → listen → log → transition)
- Categorization and severity guidelines
- Overlay mode: `hide_overlay` before screenshots, `show_overlay` after
- Drawing: use `request_drawing` when spatial feedback is vague
- Tone guidance (conversational, concise, opinionated)
- Special signals: `[[NEXT PAGE]]` and `[[WRAP UP]]`

---

## Installation (Plugin)

This is a Claude Code plugin. No manual file copying or MCP registration needed.

### From GitHub
```
/plugin install github:metamellow/claude-feedback-copilot
```

### From local directory (development)
```bash
claude --plugin-dir /path/to/claude-feedback-copilot
```

After installation:
- MCP server auto-registers (from `.mcp.json`)
- Slash command becomes available as `/feedback-copilot:review`
- Nothing is injected into target project directories

### First-time bookmarklet setup

On first use, the user needs to save the bookmarklet once:
1. Run `/feedback-copilot:review` in any project
2. Claude will tell you the bookmarklet URL (e.g. `localhost:3847/bookmarklet`)
3. Visit that URL, drag the bookmarklet to your bookmarks bar
4. Done — the bookmarklet works for all future sessions in any project

---

## Uninstall

### Plugin uninstall
```
/plugin uninstall feedback-copilot
```

This removes the MCP server registration and slash command. No files are left in target projects.

### Kill lingering processes
```bash
npx kill-port 3847
```

### Remove bookmarklet
Delete "Feedback Copilot" from your browser bookmarks bar (optional).
