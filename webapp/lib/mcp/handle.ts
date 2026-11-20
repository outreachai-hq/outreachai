import type { McpTool, JsonRpcRequest, JsonRpcResponse } from './types'

export function buildToolList(tools: McpTool[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(t.params).map(([k, v]) => [
          k,
          { type: v.type, description: v.description },
        ])
      ),
      required: Object.entries(t.params)
        .filter(([, v]) => !v.optional)
        .map(([k]) => k),
    },
  }))
}

export async function handleMcpRequest(
  body: JsonRpcRequest,
  tools: McpTool[],
  userId: string
): Promise<JsonRpcResponse> {
  const { id, method, params } = body

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'outreachai-mcp', version: '1.0.0' },
      },
    }
  }

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: buildToolList(tools) } }
  }

  if (method === 'tools/call') {
    const name = (params as { name?: string })?.name
    const args = ((params as { arguments?: Record<string, unknown> })?.arguments) ?? {}

    const tool = tools.find((t) => t.name === name)
    if (!tool) {
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Tool not found: ${name}` } }
    }

    try {
      const text = await tool.handler(args, userId)
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { jsonrpc: '2.0', id, error: { code: -32603, message } }
    }
  }

  // notifications/initialized and other one-way messages — no response needed
  if (method.startsWith('notifications/')) {
    return { jsonrpc: '2.0', id, result: null }
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } }
}
