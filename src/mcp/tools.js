const z = require('zod');

// Input schemas for each tool, used with McpServer.registerTool()
// Each key is a Zod shape object (not a z.object — McpServer wraps it)

const toolDefinitions = {
  start_review_session: {
    description: 'Opens the Feedback Copilot control panel in the browser and starts a voice-driven review session. Call this when the user wants to begin a product review.',
    inputSchema: {
      app_url: z.string().optional().describe('The URL of the app to review (e.g. http://localhost:3000)'),
      pages: z.array(z.object({
        name: z.string(),
        path: z.string(),
        description: z.string().optional(),
      })).describe('List of pages/routes to review, in suggested order'),
    },
  },

  speak: {
    description: 'Say something to the user through the review panel. The text will be displayed and spoken aloud via TTS. Use this for all communication during a review session.',
    inputSchema: {
      message: z.string().describe('What to say to the user'),
      await_response: z.boolean().optional().default(true).describe('If true, automatically activates the mic after speaking and waits for user response. Defaults to true.'),
    },
  },

  listen: {
    description: 'Activate the microphone and wait for the user to speak. Returns their transcribed speech. The user clicks a button when done.',
    inputSchema: {},
  },

  log_feedback: {
    description: 'Log a piece of review feedback. Call this after processing user speech to record structured notes.',
    inputSchema: {
      page: z.string().describe('Which page/route this applies to'),
      category: z.enum(['bug', 'visual', 'ux', 'performance', 'content', 'feature_request']).describe('Category of feedback'),
      severity: z.enum(['critical', 'major', 'minor', 'suggestion']).describe('Severity level'),
      description: z.string().describe('Description of the feedback'),
      element: z.string().optional().describe('Specific UI element if applicable (e.g. "hero CTA button")'),
    },
  },

  update_panel_state: {
    description: 'Update what the control panel displays — current page, progress, etc.',
    inputSchema: {
      current_page: z.string().optional().describe('Current page being reviewed'),
      progress: z.object({
        current: z.number(),
        total: z.number(),
      }).optional().describe('Progress through pages'),
      status: z.enum(['reviewing', 'listening', 'thinking', 'fixing']).optional().describe('Current session status'),
    },
  },

  get_review_summary: {
    description: 'Get the full structured review log. Call this at the end of a session to compile all feedback into an action plan.',
    inputSchema: {},
  },

  end_review_session: {
    description: 'End the review session and close the panel.',
    inputSchema: {},
  },

  request_drawing: {
    description: 'Ask the user to draw on the screen (e.g. circle a problematic element, highlight an area). The drawing canvas activates as an overlay on their app. Returns the drawing as a base64 PNG image. Use this when the user gives vague spatial feedback like "that thing over there" or "the part on the right."',
    inputSchema: {
      message: z.string().optional().describe('Prompt to display to the user (e.g. "Circle the element you mean")'),
      timeout: z.number().optional().default(120).describe('How long to wait for the drawing, in seconds. Default 120.'),
    },
  },

  hide_overlay: {
    description: 'Hide the floating overlay panel so the user can see the full page unobstructed. Useful before taking screenshots or when the panel covers something important.',
    inputSchema: {},
  },

  show_overlay: {
    description: 'Show the floating overlay panel again after it was hidden.',
    inputSchema: {},
  },
};

module.exports = { toolDefinitions };
