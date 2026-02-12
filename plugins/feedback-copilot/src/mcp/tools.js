const z = require('zod');

const toolDefinitions = {
  start_review_session: {
    description: 'Start a new review session. Launches the bridge server and prepares the panel. Call this first before any other tools. Returns the panel URL, injection script, and port.',
    inputSchema: {
      app_url: z.string().optional().describe('The URL of the app to review (e.g. http://localhost:3000). If omitted, the built-in test page is used.'),
      pages: z.array(z.string()).describe('List of pages/routes to review in order'),
    },
  },

  speak: {
    description: 'Say something to the user via text-to-speech in the browser panel. By default, waits for the user to respond via speech recognition. Set await_response to false to just speak without listening.',
    inputSchema: {
      message: z.string().describe('The message to speak aloud to the user'),
      await_response: z.boolean().optional().default(true).describe('If true (default), auto-activates mic after speaking and waits for user response. If false, just speaks and returns.'),
    },
  },

  listen: {
    description: 'Activate the microphone and wait for the user to speak. Returns their transcribed speech. Use this when you want to listen without speaking first.',
    inputSchema: {},
  },

  log_feedback: {
    description: 'Log a structured feedback item from the review. Call this for every piece of feedback the user gives.',
    inputSchema: {
      page: z.string().describe('Which page/route this feedback is about'),
      category: z.enum(['bug', 'visual', 'ux', 'performance', 'content', 'feature_request']).describe('Category of the feedback'),
      severity: z.enum(['critical', 'major', 'minor', 'suggestion']).describe('How severe/important this item is'),
      description: z.string().describe('Clear description of the feedback item'),
      element: z.string().optional().describe('Which UI element this is about (e.g. "hero button", "nav bar")'),
    },
  },

  update_panel_state: {
    description: 'Update the panel display with current review progress.',
    inputSchema: {
      current_page: z.string().optional().describe('Name of the page currently being reviewed'),
      progress: z.string().optional().describe('Progress text (e.g. "Page 2 of 5")'),
      status: z.string().optional().describe('Status text (e.g. "Reviewing", "Wrapping up")'),
    },
  },

  get_review_summary: {
    description: 'Get the complete review summary with all logged feedback items. Call this when wrapping up the session.',
    inputSchema: {},
  },

  end_review_session: {
    description: 'End the review session. Closes the panel and stops the bridge server.',
    inputSchema: {},
  },

  request_drawing: {
    description: 'Ask the user to draw on the screen to highlight something. A transparent canvas overlay appears and the user can draw freehand. Returns the drawing as a base64 PNG image. Use when spatial feedback is vague.',
    inputSchema: {
      message: z.string().optional().describe('Instruction to show the user (e.g. "Circle the element you mean")'),
      timeout: z.number().optional().default(120).describe('Seconds to wait for the drawing (default 120)'),
    },
  },

  hide_overlay: {
    description: 'Hide the floating overlay panel. Use this before taking screenshots of the app so the panel does not cover content.',
    inputSchema: {},
  },

  show_overlay: {
    description: 'Show the floating overlay panel again after hiding it.',
    inputSchema: {},
  },
};

module.exports = { toolDefinitions };
