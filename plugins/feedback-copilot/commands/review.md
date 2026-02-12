---
description: Start a voice-driven product review session — walks through your app page by page, listens to feedback, and fixes everything
allowed-tools: [Bash, Read, Glob, Grep, Write, Edit, "mcp__Claude_in_Chrome__tabs_context_mcp", "mcp__Claude_in_Chrome__tabs_create_mcp", "mcp__Claude_in_Chrome__navigate", "mcp__Claude_in_Chrome__javascript_tool", "mcp__Claude_in_Chrome__computer", "mcp__Claude_in_Chrome__read_page", "mcp__Claude_in_Chrome__find"]
---

# Feedback Copilot — Review Session

You are running a voice-driven product review session using the Feedback Copilot MCP tools. Walk the user through their app page by page, listen to their feedback via speech recognition, log structured items, and then fix everything.

---

## Step 0 — Detect the dev server

1. Read the project's `package.json` to find the `dev` or `start` script.
2. Check framework config files for custom port overrides:
   - `vite.config.ts` or `vite.config.js` → `server.port` (default **5173**)
   - `next.config.js` or `next.config.mjs` → default **3000**
   - `nuxt.config.ts` → default **3000**
   - `angular.json` → `serve.options.port` (default **4200**)
   - `.env` or `.env.local` → `PORT=`
3. If the dev server is **not already running**, start it in the background:
   ```
   npm run dev &
   ```
   Parse the port from its output.
4. **Fallback — no app detected**: If there is no `package.json`, no framework config, and no dev server running, offer the built-in test page:
   > "No app detected in this project. Would you like to test with the built-in demo page?"

   If the user agrees, the app URL will be `http://localhost:PORT/test` (where PORT is the bridge server port from Step 3), and pages will be `["/test"]`.

---

## Step 1 — Analyze routes

Scan the codebase for all user-facing routes/pages:
- **Next.js**: `app/**/page.tsx`, `pages/**/*.tsx`
- **Vite/React**: React Router config, `src/pages/`
- **Nuxt**: `pages/**/*.vue`
- **Angular**: routing modules
- **Static**: any `.html` files

Build a list of routes with short descriptions.

---

## Step 2 — Prioritize pages

Rank routes by user impact. Suggest a review order starting with the most critical pages (home, auth, main dashboard, etc.). Present the list to the user and ask if they want to adjust the order.

---

## Step 3 — Start the review session

Call `mcp__feedback-copilot__start_review_session` with:
- `app_url`: the dev server URL (e.g., `http://localhost:5173`)
- `pages`: the ordered array of route paths from Step 2

Save the returned `port`, `injection_script`, and `console_snippet` for the next step.

---

## Step 4 — Inject the overlay

**Automated path (Claude in Chrome MCP browser tools):**

1. Call `mcp__Claude_in_Chrome__tabs_context_mcp` with `createIfEmpty: true` to get or create a tab group.
2. Call `mcp__Claude_in_Chrome__tabs_create_mcp` to create a new tab. Save the `tabId`.
3. Call `mcp__Claude_in_Chrome__navigate` with the app URL and the `tabId`.
4. Wait 3 seconds for the page to load.
5. Call `mcp__Claude_in_Chrome__javascript_tool` with the `injection_script` from Step 3 and the `tabId`.
6. Wait 2 seconds for the WebSocket connection to establish.
7. Tell the user the review panel is ready.

**Manual fallback:** If any browser tool call fails (e.g., Chrome extension not installed), tell the user:
> "I couldn't auto-inject the overlay. Please open your app in Chrome and paste this into the browser console:"
Then provide the `console_snippet` from Step 3.

---

## Step 5 — Confirm connection

Call `mcp__feedback-copilot__speak` with a short greeting:
> "Hey! I'm ready to review your app. Let's start with [first page name]."

Set `await_response` to `false` for this initial greeting.

If speak returns `panel_not_connected`, the overlay isn't loaded yet. Ask the user to check their browser and try again.

---

## Step 6 — Begin the review loop

For **each page** in the session:

1. **Navigate**: If using browser tools, call `mcp__Claude_in_Chrome__navigate` to go to the page URL. Otherwise, ask the user to navigate manually.
2. **Update panel**: Call `mcp__feedback-copilot__update_panel_state` with the current page name and progress info.
3. **Introduce the page**: Call `mcp__feedback-copilot__speak` to describe what you see and ask for feedback:
   > "We're looking at the [page name]. What stands out to you? Any issues with the layout, copy, or functionality?"
   Set `await_response: true` to auto-listen.
4. **Listen and clarify**: When the user responds:
   - If the feedback is clear, log it immediately with `mcp__feedback-copilot__log_feedback`.
   - If the feedback is vague (e.g., "this looks weird"), ask a clarifying question via `speak`:
     > "Can you tell me more? What specifically looks off?"
   - Continue the conversation naturally until all feedback for this page is captured.
5. **Ask for drawing** (optional): If the user mentions a specific visual area, offer drawing:
   > "Want to circle the area you're talking about?"
   If yes, call `mcp__feedback-copilot__request_drawing`.
6. **Transition**: When the user is done with the page, say:
   > "Great, moving on to [next page name]."
   Call `mcp__feedback-copilot__update_panel_state` to advance.

**Important**: Keep the conversation natural and flowing. Don't rush. Let the user talk. Each piece of feedback should be logged as a separate item with appropriate category and severity.

---

## Step 7 — Wrap up the review

1. Call `mcp__feedback-copilot__get_review_summary` to get all logged feedback.
2. Call `mcp__feedback-copilot__speak` with a verbal summary:
   > "Alright, we reviewed [N] pages and found [X] items — [Y] critical, [Z] major. Let me fix these now, starting with the critical ones."
   Set `await_response: false`.
3. Call `mcp__feedback-copilot__end_review_session` to close the panel and stop the bridge server.

---

## Step 8 — Fix everything

Work through the logged feedback items, starting from **critical** severity and working down:

1. For each item, use the standard code tools (Read, Edit, Write, Grep, Glob) to find and fix the issue.
2. After fixing each item, briefly mention what you changed.
3. If a fix requires design decisions, ask the user before proceeding.
4. Skip items that are out of scope (e.g., backend infrastructure changes) and note them as deferred.

When all fixes are complete, give a final summary of what was changed and any items that were deferred.
