# MCP Implementation Patterns

Server implementation examples, transport configuration, tool annotations, elicitation, and testing.

## Contents

- [TypeScript Server](#typescript-server)
- [Python Server](#python-server)
- [Tool Annotations](#tool-annotations)
- [Elicitation](#elicitation)
- [Transport Configuration](#transport-configuration)
- [Security Hardening](#security-hardening)
- [Testing MCP Servers](#testing-mcp-servers)

---

## TypeScript Server

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "example-server",
  version: "1.0.0",
});

// Tool with annotations and output schema
server.tool(
  "search_docs",
  "Search documentation by query. Use when you need to find information in the knowledge base.",
  {
    query: z.string().describe("Search query"),
    limit: z.number().optional().default(5),
  },
  async ({ query, limit }) => {
    const results = await searchIndex(query, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);

// Resource with URI template
server.resource(
  "config",
  "config://app",
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify(appConfig),
        mimeType: "application/json",
      },
    ],
  })
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Python Server

```python
from mcp.server import Server
from mcp.server.stdio import stdio_server
import mcp.types as types

server = Server("example-server")

@server.tool()
async def search_docs(query: str, limit: int = 5) -> list[types.TextContent]:
    """Search documentation by query. Use when you need to find information."""
    results = await search_index(query, limit)
    return [types.TextContent(type="text", text=json.dumps(results, indent=2))]

@server.resource("config://app")
async def get_config() -> str:
    """Application configuration."""
    return json.dumps(app_config)

async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())
```

## Tool Annotations

Annotations describe tool behavior to help clients decide confirmation UX.

```json
{
  "name": "read_file",
  "description": "Read file contents. Use when you need to inspect a file.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" }
    },
    "required": ["path"]
  },
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": true,
    "openWorldHint": false
  }
}
```

```json
{
  "name": "delete_record",
  "description": "Delete a database record by ID. Use when removing obsolete data.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" }
    },
    "required": ["id"]
  },
  "annotations": {
    "readOnlyHint": false,
    "destructiveHint": true,
    "idempotentHint": true,
    "openWorldHint": false
  }
}
```

### Annotation Decision Matrix

| Scenario | readOnly | destructive | idempotent | UX Recommendation |
|----------|----------|-------------|------------|-------------------|
| Read data | true | false | true | Auto-approve |
| Create record | false | false | false | Light confirmation |
| Update record | false | false | true | Light confirmation |
| Delete record | false | true | true | Require confirmation |
| Send email | false | true | false | Require confirmation |

## Elicitation

### Form Mode — Collecting Structured Data

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "elicitation/create",
  "params": {
    "mode": "form",
    "message": "Configure deployment target",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "environment": {
          "type": "string",
          "enum": ["staging", "production"],
          "title": "Target Environment"
        },
        "replicas": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10,
          "default": 2,
          "title": "Number of Replicas"
        }
      },
      "required": ["environment"]
    }
  }
}
```

### URL Mode — Sensitive Operations

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "elicitation/create",
  "params": {
    "mode": "url",
    "elicitationId": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://mcp.example.com/connect/github",
    "message": "Authorize access to your GitHub repositories."
  }
}
```

URL mode rules:
- NEVER include user credentials or PII in the URL
- NEVER provide pre-authenticated URLs
- MUST verify the user who opens the URL = user who initiated elicitation
- Use HTTPS in production

## Transport Configuration

### stdio (Local)

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["server.js"],
      "env": { "API_KEY": "..." }
    }
  }
}
```

### Streamable HTTP (Remote)

```json
{
  "mcpServers": {
    "remote-server": {
      "url": "https://api.example.com/mcp",
      "headers": { "Authorization": "Bearer ..." }
    }
  }
}
```

### Streamable HTTP Server Setup (TypeScript)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

const app = express();
const server = new McpServer({ name: "remote-server", version: "1.0.0" });

// Register tools, resources, prompts...

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport("/mcp");
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

app.listen(3000);
```

## Security Hardening

- Validate all inputs with Zod/Pydantic before processing
- Use environment variables for secrets, never hardcode
- Implement rate limiting per client
- Log all tool invocations for audit
- Use HTTPS for remote transports
- Implement OAuth 2.1 for multi-tenant servers
- Return input validation errors as tool execution errors (`isError: true`), not protocol errors
- Tool annotations are untrusted metadata — clients MUST NOT auto-approve based on annotations from untrusted servers
- For URL elicitation: verify user identity on redirect to prevent phishing

## Testing MCP Servers

Use the MCP Inspector for interactive testing:
```bash
npx @modelcontextprotocol/inspector node server.js
```

Write automated tests with in-memory transport:
```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const [clientTransport, serverTransport] =
  InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);
const client = new Client({ name: "test" }, {});
await client.connect(clientTransport);

// Test tool call
const result = await client.callTool({
  name: "search_docs",
  arguments: { query: "test" },
});
assert(result.content[0].text.includes("expected"));

// Test tool list
const tools = await client.listTools();
assert(tools.tools.length > 0);
assert(tools.tools[0].annotations?.readOnlyHint !== undefined);
```
