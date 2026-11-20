import { NextRequest, NextResponse } from 'next/server'
import { handleMcpRequest } from '@/lib/mcp/handle'
import { executionTools } from '@/lib/mcp/tools/execution'
import { intelligenceTools } from '@/lib/mcp/tools/intelligence'
import type { JsonRpcRequest } from '@/lib/mcp/types'

const ALL_TOOLS = [...executionTools, ...intelligenceTools]

function authorized(req: NextRequest): boolean {
  const token = process.env.MCP_AUTH_TOKEN
  if (!token) return false // token must be configured
  const header = req.headers.get('Authorization') ?? ''
  return header === `Bearer ${token}`
}

// Health check — no auth required
export async function GET() {
  return NextResponse.json({
    server: 'outreachai-mcp',
    version: '1.0.0',
    tools: ALL_TOOLS.map((t) => t.name),
    transport: 'streamable-http',
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = req.headers.get('X-User-Id')
  if (!userId) {
    return NextResponse.json(
      { error: 'X-User-Id header required — pass the OutreachAI user ID' },
      { status: 400 }
    )
  }

  let body: JsonRpcRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error: invalid JSON' } },
      { status: 400 }
    )
  }

  const response = await handleMcpRequest(body, ALL_TOOLS, userId)
  return NextResponse.json(response)
}
