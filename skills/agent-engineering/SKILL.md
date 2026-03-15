---
name: agent-engineering
description: Design and build AI agents — orchestration, tool integration, memory, guardrails, context engineering, agent protocols. Use when building agents, choosing patterns, or coordinating multi-agent systems. Do NOT use for RAG (use rag), evals (use agent-evals), or MCP servers (use mcp).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Agent Engineering

Design and build production AI agents — orchestration patterns, tool integration, memory, guardrails, context engineering, and multi-agent coordination.

---

## Complexity Selection — Start Here

Pick the lowest level that reliably meets requirements. Each level adds coordination overhead, latency, and cost.

```
What does the task require?
├── Single model call, no tool use?
│   └── Direct prompt (no agent needed)
├── Dynamic tool use within one domain?
│   └── Single agent with tools (ReAct)
├── Cross-domain, parallel specialization, or security boundaries?
│   └── Multi-agent orchestration
└── Unsure?
    └── Start with single agent, escalate when it fails
```

| Level | Description | When |
|-------|-------------|------|
| Direct prompt | One model call, well-crafted prompt | Classification, summarization, translation |
| Single agent | One agent with tools, can loop | Most tasks — default choice |
| Multi-agent | Specialized agents coordinated by orchestrator | Cross-domain, parallel work, security isolation |

**Rule: justify multi-agent complexity.** If a single agent can handle the task with reasonable prompt complexity and tool count, do not split into multiple agents.

---

## Orchestration Patterns

| Pattern | Flow | Use When |
|---------|------|----------|
| ReAct | Think -> Act -> Observe -> repeat | Tool use with reasoning (default) |
| Plan-and-Execute | Planner creates steps -> executor runs them | Multi-step tasks with sequential dependencies |
| Sequential | Agent A -> Agent B -> Agent C (pipeline) | Each stage builds on previous output |
| Concurrent | Fan-out to N agents -> aggregate results | Independent perspectives on same input |
| Orchestrator-Worker | Central agent delegates to specialized workers | Parallel subtasks, divide-and-conquer |
| Routing | Classify input -> route to specialized handler | Multi-domain systems |
| Group Chat | Agents discuss in shared thread, manager coordinates | Brainstorming, validation, consensus |
| Reflection | Generate -> critique -> revise | Quality-sensitive output |
| Evaluator-Optimizer | Generate -> score -> refine until threshold | Iterative improvement with measurable quality |
| Human-in-the-Loop | Agent works -> checkpoint -> human approves | High-stakes, compliance-sensitive tasks |

### Decision Tree — Pattern Selection

```
What kind of task?
├── Single tool call, simple reasoning?
│   └── ReAct (simplest, most common)
├── Multi-step, sequential dependencies?
│   ├── Steps are independent?
│   │   └── Concurrent (fan-out/fan-in)
│   └── Each step depends on previous?
│       └── Sequential pipeline or Plan-and-Execute
├── Multiple domains or specializations?
│   ├── Same input, different expertise needed?
│   │   └── Routing (classify then dispatch)
│   └── Complex workflow, domain separation?
│       └── Orchestrator-Worker
├── Need group deliberation or validation?
│   └── Group Chat (multi-agent debate)
├── Quality-critical output?
│   ├── Can define scoring function?
│   │   └── Evaluator-Optimizer
│   └── Need iterative self-improvement?
│       └── Reflection
└── High-stakes decision?
    └── Human-in-the-Loop (checkpoint + approval)
```

### Cost Optimization Pattern

Use a frontier model as planner and cheaper models as executors. The planner creates the strategy; executors follow it. This can reduce costs by 60-90% compared to using frontier models for everything. Apply when tasks are decomposable and execution steps are well-defined.

---

## Tool Integration

| Principle | Detail |
|-----------|--------|
| Clear descriptions | Every tool description must say WHAT it does + WHEN to use it |
| Comprehensive over fragmented | Fewer tools with broader capability. If a human can't choose between tools, an agent won't either |
| Error handling | Include error types, causes, and recovery actions in tool descriptions |
| Parallel calls | Support parallel tool invocation for independent operations |
| Least privilege | Each agent gets only the tools it needs — treat every tool as a potential escalation path |
| Idempotency | Prefer idempotent tools. If a tool has side effects, document them explicitly |

### Tool Description Template

```
tool_name(param1: type, param2: type) -> return_type
  What: One-sentence description of what it does.
  When: Conditions under which to use this tool.
  Errors: Known error conditions and how to handle them.
  Side effects: What changes in the world (if any).
```

---

## Memory Systems

| Type | Scope | Implementation | Use When |
|------|-------|---------------|----------|
| Short-term | Current conversation | Context window | Default — always present |
| Working | Current task | Scratchpad, task state, variables | Multi-step tasks needing intermediate state |
| Long-term | Across sessions | Vector DB, structured storage, files | User preferences, learned patterns |
| Episodic | Past interactions | Conversation summaries with timestamps | Recalling specific past events |
| Semantic | Domain knowledge | Embeddings, knowledge graphs | Factual recall across domains |

### Memory Decision

```
Does the agent need to remember across turns within a session?
├── No → Short-term (context window) is sufficient
└── Yes
    ├── Structured task state? → Working memory (scratchpad)
    ├── Past conversations? → Episodic memory (summaries)
    ├── Facts and knowledge? → Semantic memory (vector DB)
    └── User preferences? → Long-term memory (persistent storage)
```

**Context window management:** Summarize old messages when context exceeds 70% capacity. Place critical instructions at start and end (U-shaped attention). Reserve output token budget.

---

## Context Engineering for Agents

The context window is a shared, finite resource. Agent performance degrades when context is mismanaged.

| Strategy | What | When |
|----------|------|------|
| Token budgeting | Allocate fixed budgets per component (system prompt, tools, history, retrieval) | Always — prevents context overflow |
| Summarization | Compress conversation history before including | Long conversations (20+ turns) |
| Structured injection | Pass retrieved docs as tagged blocks with metadata | RAG-augmented agents |
| Priority ordering | Critical info at start and end of context | All agents (U-shaped attention) |
| Context isolation | Split work across sub-agents with separate contexts | Large tasks exceeding single context |

**Rule: reserve 20-30% of context for output generation.** Never fill context to capacity.

---

## Guardrails

Defense-in-depth: layer guardrails so no single failure exposes the system.

| Layer | Threat | Mitigation |
|-------|--------|------------|
| Input validation | Prompt injection, jailbreaks | Input classifier, pattern matching, DLP for sensitive data |
| Output filtering | PII leaks, harmful content, off-topic | Regex, NER, content classifier, output schema enforcement |
| Grounding | Hallucination | Require citations, check claims against retrieved context |
| Structural | Schema violations | JSON schema validation, type checking |
| Operational | Runaway agents, infinite loops | Iteration limits, timeout, cost caps, resource budgets |
| Access control | Unauthorized actions | Least privilege per agent, sandboxing, short-lived credentials |
| Monitoring | Drift, novel attacks | Log all inputs/outputs, track guardrail trigger rates, alert on anomalies |

### Guardrail Decision

```
What risk are you mitigating?
├── Users providing malicious input?
│   └── Input validation layer (classifier + pattern matching)
├── Model generating harmful/incorrect output?
│   ├── Factual errors → Grounding checks (cite sources)
│   ├── PII/sensitive data → Output filtering (DLP + regex)
│   └── Wrong format → Structural validation (schema)
├── Agent taking unauthorized actions?
│   └── Access control (least privilege + sandboxing)
├── Agent running indefinitely or costing too much?
│   └── Operational limits (iteration cap + timeout + cost ceiling)
└── Unknown future threats?
    └── Monitoring + alerting on anomalous patterns
```

**Rule: guardrails are not set-and-forget.** Review trigger rates, adapt to new attack patterns, and update as user behavior evolves.

---

## Agent Protocols

Protocols standardize how agents connect to tools and to each other.

| Protocol | Purpose | Use When |
|----------|---------|----------|
| MCP (Model Context Protocol) | Agent-to-tool connectivity | Connecting agents to external tools, data sources, APIs |
| A2A (Agent-to-Agent) | Agent-to-agent communication | Multi-agent systems with agents from different frameworks/vendors |
| ACP (Agent Communication Protocol) | Enterprise agent governance | Enterprise deployments requiring compliance and audit trails |

### Protocol Selection

```
What connectivity do you need?
├── Agent needs external tools/data?
│   └── MCP — standardized tool integration
├── Agents from different vendors/frameworks need to collaborate?
│   └── A2A — cross-framework agent discovery and communication
├── Enterprise governance and compliance required?
│   └── ACP — governance-first agent coordination
└── Single-framework, same-vendor agents?
    └── Framework-native communication (no protocol needed)
```

For MCP implementation details, use the **mcp** skill.

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Single monolithic agent | Context-bloated, slow, hard to debug | Orchestrator-worker with specialized agents |
| Multi-agent when single suffices | Coordination overhead without benefit | Start with single agent, split only when it fails |
| No prompt versioning | Can't reproduce or compare results | Version prompts + eval sets, track metrics |
| No guardrails on output | PII leaks, hallucinations, runaway agents | Layered guardrails (input + output + operational) |
| No prompt injection defense | Users override system instructions | Input classifier + structural separation of user/system |
| Provider lock-in | Vendor dependency, no fallback | Abstract behind provider-agnostic interface |
| Over-broad tool permissions | Any tool = potential escalation path | Least privilege per agent, explicit allow-list |
| No iteration limits | Infinite loops, cost explosion | Set max turns, timeout, and cost ceiling per agent |
| Stuffing context with everything | Degrades model attention, wastes tokens | Token budgets, summarization, progressive disclosure |

---

## Prompt Engineering Quick Reference

| Pattern | When | Key Technique |
|---------|------|---------------|
| System prompt | Set role + constraints + format | Imperative tone, explicit rules |
| Few-shot | Consistent output format | 2-3 input/output examples |
| Chain-of-thought | Complex reasoning | "Think step by step" |
| Self-consistency | High-stakes decisions | N answers at temperature 0.7, majority vote |
| Structured output | Parse-friendly responses | JSON schema or TypeScript interface in prompt |
| Output priming | Force specific format | Prefill start of assistant response |
| Prompt scaffolding | Defend against injection | XML-tagged sections, separate system/user |

For detailed prompt templates, tool use patterns, and safety code, see references.

---

## Related Knowledge

- **rag** skill — retrieval-augmented generation pipelines
- **agent-evals** skill — evaluating agent performance and quality
- **mcp** skill — Model Context Protocol implementation
- **ai-engineer** skill — production AI feature implementation (uses agent patterns)
- **observability** skill — tracing and monitoring agent pipelines
- **security** skill — application security (complements agent access control)

## References

- [prompt-patterns.md](references/prompt-patterns.md) — Prompt templates, tool use patterns, structured output, safety code
