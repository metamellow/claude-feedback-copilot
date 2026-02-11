const { BridgeServer } = require('../bridge/server');
const { SessionState } = require('../session/state');
const { ReviewLog } = require('../session/review-log');

let bridge = null;
let session = null;
let reviewLog = null;

const handlers = {
  async start_review_session({ app_url, pages }) {
    session = new SessionState(pages);
    reviewLog = new ReviewLog();

    bridge = new BridgeServer();
    await bridge.start();

    // Send initial state to panel
    bridge.send('init', {
      appUrl: app_url,
      pages: pages,
    });

    return {
      status: 'session_started',
      panel_url: bridge.url,
      bookmarklet_url: bridge.bookmarkletUrl,
      console_snippet: `document.body.appendChild(Object.assign(document.createElement('script'),{src:'http://localhost:${bridge.port}/overlay.js'}))`,
      pages_to_review: pages.length,
      next_step: 'The browser panel is NOT connected yet. No page was auto-opened. Tell the user via normal text (NOT speak): "The review server is running. Open your app at [app_url] in your browser, then click the Feedback Copilot bookmarklet to inject the overlay. If you don\'t have the bookmarklet, paste this into your console: [console_snippet]. Let me know when you see Connected in the panel." Wait for confirmation before calling speak.',
    };
  },

  async speak({ message, await_response }) {
    if (!bridge) throw new Error('No active session. Call start_review_session first.');

    // Check if panel is connected before blocking on WS events
    if (!bridge.connection.isConnected()) {
      return {
        status: 'panel_not_connected',
        message_queued: message,
        instructions: 'The browser panel is not connected yet. Tell the user (via normal text, NOT speak) to open their app and inject the Feedback Copilot overlay using the bookmarklet. The bookmarklet page is at: ' + bridge.bookmarkletUrl + '. Once they confirm the panel shows "Connected", call speak again.',
      };
    }

    // Default await_response to true
    const shouldAwait = await_response !== false;

    bridge.send('speak', { message });

    if (shouldAwait) {
      // Wait for speech to finish, then auto-listen
      const transcript = await bridge.waitForEvent('user_speech');
      return { user_said: transcript };
    }

    // Just wait for TTS to finish
    await bridge.waitForEvent('speech_complete');
    return { status: 'spoken' };
  },

  async listen() {
    if (!bridge) throw new Error('No active session.');
    bridge.send('listen_start', {});
    const transcript = await bridge.waitForEvent('user_speech');
    return { user_said: transcript };
  },

  async log_feedback(item) {
    if (!reviewLog) throw new Error('No active session.');
    reviewLog.add(item);
    if (bridge) {
      bridge.send('log_update', { log: reviewLog.getAll() });
    }
    return { status: 'logged', total_items: reviewLog.count() };
  },

  async update_panel_state(state) {
    if (!bridge) throw new Error('No active session.');
    bridge.send('state_update', state);
    return { status: 'updated' };
  },

  async get_review_summary() {
    if (!reviewLog) throw new Error('No active session.');
    return {
      summary: reviewLog.getSummary(),
      items: reviewLog.getAll(),
      total: reviewLog.count(),
    };
  },

  async request_drawing({ message, timeout }) {
    if (!bridge) throw new Error('No active session.');
    const timeoutMs = (timeout || 120) * 1000;
    bridge.send('request_drawing', { message: message || 'Draw on the screen to highlight what you mean.' });
    const imageData = await bridge.waitForEvent('drawing_complete', timeoutMs);
    return {
      status: 'drawing_received',
      image: imageData,
    };
  },

  async hide_overlay() {
    if (!bridge) throw new Error('No active session.');
    bridge.send('hide_overlay', {});
    return { status: 'overlay_hidden' };
  },

  async show_overlay() {
    if (!bridge) throw new Error('No active session.');
    bridge.send('show_overlay', {});
    return { status: 'overlay_shown' };
  },

  async end_review_session() {
    if (bridge) {
      const summary = reviewLog ? reviewLog.getSummary() : {};
      bridge.send('session_end', { summary });
      await bridge.stop();
      bridge = null;
      session = null;
      reviewLog = null;
    }
    return { status: 'session_ended' };
  },
};

async function handleToolCall(name, args) {
  const handler = handlers[name];
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  return handler(args);
}

module.exports = { handleToolCall };
