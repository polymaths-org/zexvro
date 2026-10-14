// A tiny MCP server for tests: a "pharmacy" with one tool. Run as: node e2e/fixtures/mcp-server.mjs
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({ name: 'pharmacy', version: '1.0.0' })

server.registerTool(
  'opening_hours',
  { description: 'Opening hours of the local pharmacy on a given day', inputSchema: { day: z.string() } },
  async ({ day }) => ({ content: [{ type: 'text', text: `On ${day} the pharmacy is open from 9 am to 8 pm.` }] })
)

await server.connect(new StdioServerTransport())
