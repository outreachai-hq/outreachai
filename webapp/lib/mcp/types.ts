export type ParamSchema = {
  type: 'string' | 'number' | 'boolean'
  description: string
  optional?: boolean
}

export type McpTool = {
  name: string
  description: string
  params: Record<string, ParamSchema>
  handler: (args: Record<string, unknown>, userId: string) => Promise<string>
}

export type JsonRpcRequest = {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: string | number; result: unknown }
  | { jsonrpc: '2.0'; id: string | number; error: { code: number; message: string } }
