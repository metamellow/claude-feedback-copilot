# Claude Feedback Copilot — Build Plan

Voice-driven product review sessions for Claude Code. A plugin that opens a browser panel overlaid on the user's app, walks them through each page, listens to voice feedback via speech recognition, logs structured items, and then fixes everything. Uses MCP browser tools (Claude in Chrome) for zero-friction overlay injection.

---

## 1. Plugin Directory Structure

This is a **Claude Code marketplace plugin**. The directory structure MUST follow this exact layout:

```
claude-feedback-copilot/              ← GitHub repo root / marketplace root
├── .claude-plugin/
│   └── marketplace.json              ← Marketplace manifest (lists plugins)
├── plugins/
│   └── feedback-copilot/             ← Plugin root (referenced by marketplace.json)
│       ├── .claude-plugin/
│       │   └── plugin.json           ← Plugin manifest (name, version, description)
│       ├── .mcp.json                 ← MCP server config (auto-registered on install)
│       ├── package.json              ← Node.js dependencies
│       ├── commands/
│       │   └── review.md             ← Slash command → /feedback-copilot:review
│       ├── test/
│       │   └── index.html            ← Built-in test page (no framework needed)
│       └── src/
│           ├── mcp/
│           │   ├── bootstrap.js      ← Entry point (auto-installs deps, then starts server)
│           │   ├── index.js          ← MCP server (McpServer + registerTool)
│           │   ├── tools.js          ← Tool definitions (Zod schemas, 10 tools)
│           │   └── handlers.js       ← Tool execution logic
│           ├── bridge/
│           │   ├── server.js         ← Express + WebSocket server + overlay routes
│           │   └── connection.js     ← WebSocket connection manager
│           ├── session/
│           │   ├── state.js          ← Session state machine
│           │   └── review-log.js     ← Structured feedback log
│           └── panel/
│               ├── index.html        ← Panel UI
│               ├── styles.css        ← Styles (with overlay-mode overrides)
│               ├── app.js            ← Panel client (WebSocket, speech, draw mode)
│               └── overlay.js        ← Injection payload (floating iframe + drawing canvas)
├── BUILD-PLAN.md
├── README.md
└── .gitignore                        ← Must include node_modules/
```

**CRITICAL**: The `plugins/feedback-copilot/` subdirectory is mandatory. Claude Code expects marketplace repos to have plugins inside `plugins/<name>/`. Putting plugin files at the repo root will NOT work.

---

## 2. Plugin System Requirements

### marketplace.json (at repo root: `.claude-plugin/marketplace.json`)

```json
{
  "name": "feedback-copilot",
  "owner": { "name": "metamellow" },
  "plugins": [
    {
      "name": "feedback-copilot",
      "source": "./plugins/feedback-copilot",
      "description": "Voice-driven product review sessions for Claude Code...",
      "version": "1.0.0",
      "category": "productivity"
    }
  ]
}
```

**CRITICAL**: The `source` field MUST be a relative local path (`"./plugins/feedback-copilot"`), NOT a GitHub URL object. This is how Claude Code resolves the plugin within the cloned repo.

### plugin.json (at plugin root: `plugins/feedback-copilot/.claude-plugin/plugin.json`)

```json
{
  "name": "feedback-copilot",
  "description": "Voice-driven product review sessions for Claude Code...",
  "version": "1.0.0",
  "author": { "name": "metamellow" },
  "repository": "https://github.com/metamellow/claude-feedback-copilot",
  "license": "MIT",
  "keywords": ["feedback", "review", "voice", "product", "ux"]
}
```

### .mcp.json (at plugin root: `plugins/feedback-copilot/.mcp.json`)

```json
{
  "mcpServers": {
    "feedback-copilot": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/src/mcp/bootstrap.js"],
      "cwd": "${CLAUDE_PLUGIN_ROOT}"
    }
  }
}
```

**CRITICAL**: Use `${CLAUDE_PLUGIN_ROOT}` — this environment variable is set by Claude Code and resolves to the plugin's installed location (e.g., `~/.claude/plugins/marketplaces/feedback-copilot/plugins/feedback-copilot/`).

**CRITICAL**: Point to `bootstrap.js`, NOT `index.js`. Claude Code does NOT run `npm install` after cloning plugins. The bootstrap script handles this.

### bootstrap.js (`src/mcp/bootstrap.js`)

```javascript
#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const nodeModules = path.join(root, 'node_modules');

if (!fs.existsSync(nodeModules)) {
  process.stderr.write('Feedback Copilot: installing dependencies (first run)...\n');
  execSync('npm install --silent', { cwd: root, stdio: ['pipe', 'pipe', 'inherit'] });
  process.stderr.write('Feedback Copilot: dependencies installed.\n');
}

require('./index.js');
```

Status messages go to **stderr** (MCP uses stdin/stdout for transport — anything on stdout corrupts the protocol).

### commands/review.md — YAML Frontmatter

```yaml
---
description: Start a voice-driven product review session — walks through your app page by page, listens to feedback, and fixes everything
allowed-tools: [Bash, Read, Glob, Grep, Write, Edit, "mcp__Claude_in_Chrome__tabs_context_mcp", "mcp__Claude_in_Chrome__tabs_create_mcp", "mcp__Claude_in_Chrome__navigate", "mcp__Claude_in_Chrome__javascript_tool", "mcp__Claude_in_Chrome__computer", "mcp__Claude_in_Chrome__read_page", "mcp__Claude_in_Chrome__find"]
---
```

**CRITICAL**: The `---` frontmatter block is REQUIRED. Without it, the command file will not be recognized by the plugin system. The `allowed-tools` list must include MCP browser tools for auto-injection.

### Plugin naming and namespacing

- Plugin name in all manifests: `feedback-copilot`
- Command file `review.md` auto-discovers as `/feedback-copilot:review`
- MCP server registers as `feedback-copilot` — tools appear as `mcp__feedback-copilot__<tool_name>`
- The `enabledPlugins` entry in `~/.claude.json` uses format: `"feedback-copilot@feedback-copilot": true`

---

## 3. Dependencies

```json
{
  "name": "claude-feedback-copilot",
  "version": "1.0.0",
  "description": "Voice-driven product review sessions for Claude Code",
  "main": "src/mcp/index.js",
  "scripts": { "start": "node src/mcp/index.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0",
    "express": "^4.18.0",
    "ws": "^8.16.0",
    "zod": "^3.25.0"
  },
  "engines": { "node": ">=18.0.0" }
}
```

- `@modelcontextprotocol/sdk` — MCP server framework. Use `McpServer` from `server/mcp.js`, NOT deprecated `Server` class.
- `express` — HTTP server for panel UI and overlay.js serving.
- `ws` — WebSocket server for real-time communication between MCP server and browser panel.
- `zod` — Input schema validation for MCP tools. Also a transitive dep of SDK, but declare explicitly.
- **No `open` package** — the server does not auto-open any browser pages.
- **No `bin` entry** — the plugin system replaces any CLI init command.

The MCP SDK provides CJS builds via exports map despite its `"type": "module"`. Our project uses CommonJS throughout.

---

## 4. MCP Server Implementation

### index.js — Server Setup

```javascript
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
```

Register tools in a loop:

```javascript
for (const [name, def] of Object.entries(toolDefinitions)) {
  server.registerTool(name, {
    description: def.description,
    inputSchema: def.inputSchema,  // Zod shape object, NOT z.object()
  }, async (args) => {
    const result = await handleToolCall(name, args);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });
}
```

Connect via stdio:

```javascript
const transport = new StdioServerTransport();
await server.connect(transport);
```

### tools.js — Tool Definitions

Each tool is `{ description, inputSchema }` where `inputSchema` is a Zod **shape object** (key-value pairs), NOT wrapped in `z.object()`. McpServer wraps it internally.

```javascript
const z = require('zod');

const toolDefinitions = {
  speak: {
    description: 'Say something to the user via text-to-speech...',
    inputSchema: {
      message: z.string().describe('What to say'),
      await_response: z.boolean().optional().default(true).describe('Wait for user speech response'),
    },
  },
  // ... 10 tools total
};
```

### 10 MCP Tools

| Tool | Description |
|------|-------------|
| `start_review_session` | Starts bridge server. Returns `port`, `panel_url`, `bookmarklet_url`, `console_snippet`, `injection_script`. |
| `speak` | TTS message to user. `await_response: true` (default) auto-listens after. Checks `isConnected()` first. |
| `listen` | Activate mic, wait for user speech transcription. |
| `log_feedback` | Log structured feedback (page, category, severity, description). |
| `update_panel_state` | Update panel display (current page, progress). |
| `get_review_summary` | Get full review log for fix phase. |
| `end_review_session` | Close session, stop bridge server. |
| `request_drawing` | Ask user to draw on screen. Returns base64 PNG. |
| `hide_overlay` | Hide floating overlay (for screenshots). |
| `show_overlay` | Show floating overlay again. |

### handlers.js — Key Patterns

**Stale bridge cleanup** — `start_review_session` must close any previous bridge before creating a new one:

```javascript
if (bridge) {
  try { await bridge.stop(); } catch (e) { /* ignore */ }
  bridge = null;
}
```

**Panel connection check** — `speak` must check `bridge.connection.isConnected()` before blocking on WebSocket events. If panel not connected, return `{ status: 'panel_not_connected', instructions }` immediately.

**start_review_session return** — must include `port`, `injection_script`, `console_snippet`, `next_step` with instructions for both automated and manual overlay injection paths.

---

## 5. Bridge Server

### server.js — Express + WebSocket

CORS middleware — apply to ALL responses:

```javascript
this.app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Permissions-Policy', 'microphone=(self)');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
```

**CRITICAL**: The `Cross-Origin-Resource-Policy: cross-origin` header is required. Without it, apps with Cross-Origin Embedder Policy (COEP) — like Next.js — will block overlay.js loading with `ERR_BLOCKED_BY_RESPONSE`.

**CRITICAL**: The `Permissions-Policy: microphone=(self)` header is required for speech recognition in the iframe.

### Routes

- `GET /overlay.js` — Read `panel/overlay.js`, replace `__PORT__` with actual port, serve as `application/javascript`
- `GET /bookmarklet` — HTML instruction page with bookmarklet link and console paste fallback
- Static files — `express.static()` serves the panel directory (index.html, app.js, styles.css)

### Port Management

Default port: `3847`. On `EADDRINUSE`, increment and retry (max 10 attempts). Log retries to stderr:

```javascript
process.stderr.write(`Feedback Copilot: port ${this.port} in use, trying ${this.port + 1}...\n`);
```

### connection.js — WebSocket Manager

- `register(ws)` — stores WebSocket, sets up JSON message handler, resolves pending event promises
- `send(payload)` — JSON serialize and send to connected client
- `waitForEvent(name, timeout)` — returns Promise that resolves when the named event arrives, rejects on timeout (default 120s)
- `isConnected()` — returns true if a WebSocket client is connected
- `close()` — closes WebSocket and rejects all pending promises

---

## 6. Overlay + Panel

### overlay.js — Injection Payload

Runs in the **host page context** (the user's app). Self-contained IIFE. Creates:

1. **Floating container** (`#fc-overlay-root`) — fixed position, bottom-right, 380x540px, z-index 2147483646
   - Drag handle (mousedown + mousemove drag, touch support)
   - Minimize/expand toggle button
   - iframe (`allow="microphone"`) pointing to `http://localhost:PORT/?overlay=true`

2. **Drawing canvas** (`#fc-draw-canvas`) — full-viewport, transparent, z-index 2147483645
   - Mouse + touch drawing (red #ff3b30, 3px lines, round caps)
   - "Done Drawing" floating button
   - Escape key finishes drawing
   - Captures canvas as PNG via `toDataURL()`

3. **postMessage bridge** — listens for messages from the panel iframe:
   - `fc-start-drawing` → activate canvas
   - `fc-stop-drawing` → capture and finish
   - `fc-clear-drawing` → clear canvas
   - `fc-hide-overlay` / `fc-show-overlay` → toggle visibility

**Port injection**: The `__PORT__` placeholder in overlay.js is replaced by the bridge server's `/overlay.js` route at serve time. The iframe always points to the correct port.

### Panel (index.html + app.js + styles.css)

The panel loads inside the overlay iframe at `http://localhost:PORT/?overlay=true`.

**Overlay detection**: `app.js` reads `?overlay=true` from URL → adds `overlay` class to body → compact CSS kicks in (smaller padding, constrained log height).

**Speech synthesis (output)**: Uses `window.speechSynthesis` API. Prefers voices like "Samantha" or "Google UK English Female". Receives `speak` events via WebSocket, sends `speech_complete` when done.

**Speech recognition (input)**: Uses Web Speech API (`webkitSpeechRecognition`). Two modes: hold-to-talk and click-to-toggle. Spacebar toggles recording. Sends transcripts as `user_speech` WebSocket events.

**Drawing mode**: Receives `request_drawing` event → sends `fc-start-drawing` postMessage to parent → user draws on canvas → `fc-drawing-complete` postMessage returns image data → sends `drawing_complete` WebSocket event.

**Review log display**: Renders feedback items grouped by page, color-coded by severity (critical/major/minor/suggestion), with category badges.

**XSS protection**: All dynamic text rendered via `innerHTML` MUST be sanitized through an `escapeHtml()` function.

### Drawing Data Flow

```
Claude calls request_drawing tool
  → handlers.js sends 'request_drawing' via WebSocket
  → panel app.js receives, calls startDrawMode()
  → panel sends postMessage {type:'fc-start-drawing'} to parent
  → overlay.js activates canvas (pointer-events: auto, crosshair cursor)
  → user draws freehand (red strokes)
  → user clicks Done / presses Escape
  → overlay.js captures canvas.toDataURL('image/png')
  → overlay.js sends postMessage {type:'fc-drawing-complete', imageData} to iframe
  → panel app.js receives, sends 'drawing_complete' via WebSocket
  → handlers.js resolves waitForEvent, returns base64 image to Claude
```

---

## 7. Session Flow (review.md)

The slash command (`/feedback-copilot:review`) is the orchestration brain. It instructs Claude through a complete review session.

### Step 0 — Detect dev server

Read `package.json` scripts. Check framework configs for port overrides:
- `vite.config.ts/.js` → `server.port` (default 5173)
- `next.config.js/.mjs` → default 3000
- `nuxt.config.ts` → default 3000
- `angular.json` → `serve.options.port` (default 4200)
- `.env` / `.env.local` → `PORT=`

If dev server not running, start it in background (`npm run dev`). Parse port from output.

### Step 1-2 — Analyze routes, prioritize pages

### Step 3 — Call `start_review_session`

### Step 4 — Inject overlay (automated path via MCP browser tools)

1. `mcp__Claude_in_Chrome__tabs_context_mcp` with `createIfEmpty: true`
2. `mcp__Claude_in_Chrome__tabs_create_mcp` → get tabId
3. `mcp__Claude_in_Chrome__navigate` → open app URL in tab
4. Wait 3 seconds for page load
5. `mcp__Claude_in_Chrome__javascript_tool` → inject `injection_script` from start_review_session return
6. Wait 2 seconds for WebSocket connection
7. Tell user the panel is ready

**Fallback**: If any browser tool fails (extension not installed), tell user to paste `console_snippet` into browser console manually.

### Step 5-6 — Confirm connection, begin review

### Review loop

For each page: speak context → listen to feedback → clarify if vague → log each item → transition to next page.

### Wrap up

Get review summary → verbal summary via speak → end session → fix all items starting from critical severity.

---

## 8. Guardrails

These are hard-won rules. Follow them exactly.

### MCP Server

- **DO** use `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
- **DO NOT** use the deprecated `Server` class — it has a different API and will cause silent failures
- **DO** pass Zod shape objects (key-value pairs) to `registerTool()` inputSchema
- **DO NOT** wrap schemas in `z.object()` — McpServer does this internally; double-wrapping breaks validation
- **DO** use `StdioServerTransport` — MCP communicates via stdin/stdout
- **DO NOT** write anything to stdout except MCP protocol messages — use stderr for logging

### Plugin System

- **DO** put plugin files in `plugins/feedback-copilot/` subdirectory, NOT at repo root
- **DO** use `"source": "./plugins/feedback-copilot"` in marketplace.json (relative local path)
- **DO NOT** use a GitHub URL object as the source — it won't resolve correctly for installed plugins
- **DO** include YAML frontmatter (`---` block) in command .md files with `description` and `allowed-tools`
- **DO** use `bootstrap.js` as the .mcp.json entry point (handles missing node_modules)
- **DO NOT** assume Claude Code runs `npm install` — it doesn't
- **DO** use `${CLAUDE_PLUGIN_ROOT}` for paths in .mcp.json

### Bridge Server

- **DO** set `Cross-Origin-Resource-Policy: cross-origin` header on all responses
- **DO** set `Permissions-Policy: microphone=(self)` header
- **DO** set `Access-Control-Allow-Origin: *` header
- **DO** replace `__PORT__` in overlay.js at serve time (not build time)
- **DO** add port retry with max attempts and stderr logging
- **DO NOT** auto-open any browser pages (no `open` package)
- **DO** clean up stale bridge in `start_review_session` before creating a new one

### Panel + Overlay

- **DO** set `allow="microphone"` on the overlay iframe element
- **DO** sanitize all dynamic text with `escapeHtml()` before using `innerHTML`
- **DO** check `bridge.connection.isConnected()` in the `speak` handler before blocking on WebSocket events
- **DO NOT** call `speak` before the panel is connected — return `panel_not_connected` status instead
- **DO** use postMessage bridge between overlay.js (host page) and panel iframe for drawing communication
- **DO** support both mouse and touch events for drag and drawing

### Browser Integration

- **DO** include Claude in Chrome MCP tools in `allowed-tools` frontmatter
- **DO** try automated overlay injection via `javascript_tool` first
- **DO** fall back to manual console paste if browser tools are unavailable
- **DO** use the `injection_script` from `start_review_session` return (contains correct port)
- **DO NOT** hardcode port numbers in injection scripts — always use the port from the bridge server

### General

- Mixed content: overlay only works on HTTP pages (localhost dev apps). HTTPS pages block HTTP scripts.
- Port conflicts: use `npx kill-port 3847` to clear stale processes
- Drawing PNGs are typically 5-20KB (mostly transparent canvas)
- All WebSocket events use JSON format: `{ event: 'name', data: {...} }`

---

## 9. Built-in Test Page

The plugin includes a minimal test page so you can test the full overlay/speech/drawing flow without needing a real project.

### File: `plugins/feedback-copilot/test/index.html`

A simple static HTML page with inline CSS (no framework, no build step). Should include:

- **Hero section** — heading, subtitle, a CTA button
- **Cards section** — 3 simple product/feature cards in a row
- **Footer** — basic footer with links

The page should look like a real (but minimal) app so you can give realistic feedback like "the button is too small" or "the cards need more spacing."

### Serving the test page

The bridge server (`server.js`) should add a route:

```javascript
this.app.use('/test', express.static(path.join(__dirname, '..', '..', 'test')));
```

This serves the test page at `http://localhost:3847/test`.

### Integration with review.md

The `review.md` command (Step 0 — detect dev server) should add a fallback:

> If no `package.json` exists, no framework is detected, and no dev server is running, offer to use the built-in test page: "No app detected in this project. Would you like to test with the built-in demo page at `http://localhost:PORT/test`?"

When using the test page, `start_review_session` should be called with:
- `app_url`: `http://localhost:PORT/test`
- `pages`: `["/test"]` (single page)

This lets you test the complete flow — overlay injection, TTS, speech recognition, drawing, feedback logging — without any external project.

### Directory structure update

```
plugins/feedback-copilot/
├── test/
│   └── index.html            ← Built-in test page (minimal HTML + inline CSS)
├── src/
│   └── ...
```

---

## 10. Installation

### From GitHub

```
/plugin install github:metamellow/claude-feedback-copilot
```

Or use the Desktop app's "Add marketplace from GitHub" UI: `metamellow/claude-feedback-copilot`

### After installation

- MCP server auto-registers from `.mcp.json`
- Slash command available as `/feedback-copilot:review`
- First run: `bootstrap.js` auto-installs npm dependencies (takes ~10 seconds)
- Nothing is injected into target project directories

### Uninstall

```
/plugin uninstall feedback-copilot
```

Kill lingering processes: `npx kill-port 3847`
