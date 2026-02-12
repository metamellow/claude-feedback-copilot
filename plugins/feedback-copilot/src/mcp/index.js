const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { toolDefinitions } = require('./tools');
const { handleToolCall } = require('./handlers');

const server = new McpServer(
  { name: 'feedback-copilot', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Register all tools from definitions
for (const [name, def] of Object.entries(toolDefinitions)) {
  server.registerTool(name, {
    description: def.description,
    inputSchema: def.inputSchema, // Zod shape object, NOT z.object()
  }, async (args) => {
    try {
      const result = await handleToolCall(name, args);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  });
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Feedback Copilot: fatal error: ${err.message}\n`);
  process.exit(1);
});
