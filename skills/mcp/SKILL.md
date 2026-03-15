---
name: mcp
description: Implement MCP servers and clients — tools, resources, prompts, transport, annotations, elicitation, sampling, tasks, OAuth 2.1. Use when building MCP servers, designing tool interfaces, or configuring transport. Do NOT use for agent orchestration (use agent-engineering) or RAG pipelines (use rag).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Model Context Protocol (MCP)

Open protocol (JSON-RPC 2.0) for connecting AI agents to external data and tools. Standardized interface across hosts (Claude Desktop, IDEs), clients (connectors inside hosts), and servers (capability providers).

## Architecture

```
Host (LLM application)
├── Client A ←→ Server A (tools, resources)
├── Client B ←→ Server B (prompts, sampling)
└── Client C ←→ Server C (resources)
```

- **Host** — LLM application that creates and manages clients
- **Client** — 1:1 connection to a server, handles capability negotiation
- **Server** — exposes tools, resources, and/or prompts

## Decision Tree — When to Use MCP

```
Need to connect an AI agent to external data/tools?
├── Single integration, simple API?
│   └── Direct API call (MCP is overhead)
├── Multiple tools/data sources?
│   └── MCP server (standardized interface)
├── Interoperability across AI clients (Claude, Cursor, etc.)?
│   └── MCP server
├── Remote server needing auth + multi-tenant?
│   └── MCP server with streamable HTTP + OAuth 2.1
└── Platform for third-party integrations?
    └── MCP server ecosystem
```

## Server Primitives

| Primitive | Direction | Purpose | Key Rule |
|-----------|-----------|---------|----------|
| **Tools** | Model-controlled | Actions the agent invokes | Description = WHAT + WHEN + negative triggers |
| **Resources** | Application-controlled | Data read via URI | Use URI schemes: `file://`, `db://`, `https://` |
| **Prompts** | User-controlled | Reusable prompt templates | Include description + required arguments |

Client-side primitives (server requests from client):

| Primitive | Purpose |
|-----------|---------|
| **Sampling** | Server requests LLM completion through client |
| **Elicitation** | Server requests user input (form or URL mode) |
| **Roots** | Server queries filesystem/URI boundaries |

## Tool Design Rules

- Name: 1-128 chars, `[A-Za-z0-9_\-.]`, case-sensitive, unique per server
- Description MUST include WHAT it does + WHEN to use it
- Input schema: JSON Schema (2020-12 default), validate all parameters
- Output schema (optional): enables structured content validation
- Return structured results, not raw data — context tokens are expensive
- Errors: use `isError: true` for business/validation errors (model can self-correct), JSON-RPC errors for protocol issues

### Tool Annotations

Metadata hints about tool behavior. Clients MUST treat as untrusted unless from trusted servers.

| Annotation | Type | Default | Purpose |
|-----------|------|---------|---------|
| `readOnlyHint` | boolean | false | Tool does not modify state |
| `destructiveHint` | boolean | true | Tool may perform destructive operations |
| `idempotentHint` | boolean | false | Safe to call repeatedly with same args |
| `openWorldHint` | boolean | true | Tool interacts with external entities |

Use annotations to help clients decide confirmation UX: read-only + idempotent = auto-approve; destructive = require confirmation.

## Transport Layers

| Transport | When | Auth |
|-----------|------|------|
| **stdio** | Local process, CLI tools | N/A (process-level) |
| **Streamable HTTP** | Remote servers (recommended) | OAuth 2.1 |
| ~~SSE~~ | Legacy HTTP transport | Deprecated — migrate to streamable HTTP |

### Streamable HTTP Details

- Single HTTP endpoint for all communication
- Client sends JSON-RPC via POST, receives responses or SSE streams
- Supports session management via `Mcp-Session-Id` header
- Server MUST respond 403 for invalid Origin headers
- Supports stateless operation for horizontal scaling

### OAuth 2.1 for Remote Servers

- Server advertises auth via `.well-known/oauth-authorization-server` or Protected Resource Metadata (RFC 9728)
- Supports OpenID Connect Discovery 1.0
- Incremental scope consent via `WWW-Authenticate`
- Client registration via OAuth Client ID Metadata Documents
- Token passthrough is forbidden — servers MUST NOT relay client tokens to third parties

## Elicitation

Server requests user input during tool execution. Two modes:

| Mode | Purpose | Data Visibility |
|------|---------|----------------|
| **Form** | Structured data collection (flat JSON schema) | Client sees data |
| **URL** | Sensitive input, OAuth flows, payments | Client sees URL only |

Form schemas: string, number, boolean, enum (single/multi-select). No nested objects.

URL mode: server directs user to external URL. MUST verify user identity on redirect. NEVER include sensitive data in URL.

## Sampling

Server requests LLM completion through client. Client controls:
- Whether sampling occurs
- The actual prompt sent
- What results the server sees

Supports tool calling via `tools` and `toolChoice` parameters. Always requires user approval.

## Tasks (Experimental)

Async execution: call-now, fetch-later. Any request can become a task.

States: `working` → `input_required` | `completed` | `failed` | `cancelled`

Tools declare task support: `"forbidden"` (default), `"optional"`, `"required"`.

## Security Rules

- Validate all tool inputs against schema before execution
- Least privilege: each tool gets minimal required permissions
- Rate limit tool invocations per client
- Never expose credentials in tool responses
- Log all tool invocations with parameters for audit
- Input validation errors → tool execution errors (not protocol errors) so models can self-correct
- For URL elicitation: MUST verify user who started elicitation = user who completes it (prevents phishing)

## Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| Too many granular tools | Agent cannot decide which to use | Consolidate into fewer comprehensive tools |
| Vague tool descriptions | Agent picks wrong tool | WHAT + WHEN + negative triggers in description |
| No input validation | Injection attacks, crashes | Validate against JSON Schema |
| Returning raw HTML/data | Wastes context tokens | Return structured, summarized results |
| No error handling | Agent gets stuck | `isError: true` with recovery hints |
| Missing tool annotations | Client cannot determine safety | Add readOnlyHint, destructiveHint |
| Token passthrough | Security boundary violation | Server manages its own credentials |
| Sensitive data in form elicitation | Data exposed to client/LLM | Use URL mode for credentials, API keys |

## Related Knowledge

- **agent-engineering** — agent patterns that consume MCP tools
- **security** — API security, OAuth2, input validation depth
- **auth** — OAuth 2.1 implementation details
- **api-design** — API design principles for tool interfaces

## References

- [mcp-patterns.md](references/mcp-patterns.md) — Server implementation examples, transport configuration, testing
