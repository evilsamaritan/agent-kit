# Prompt Patterns

Prompt templates, chain-of-thought, tool use, structured output, and safety.

## Contents

- [Prompt Architecture](#prompt-architecture)
- [System Prompt Patterns](#system-prompt-patterns)
- [Few-Shot Patterns](#few-shot-patterns)
- [Chain-of-Thought Patterns](#chain-of-thought-patterns)
- [Tool Use Patterns](#tool-use-patterns)
- [Structured Output Patterns](#structured-output-patterns)
- [Safety and Guardrails](#safety-and-guardrails)
- [Prompt Testing](#prompt-testing)

---

## Prompt Architecture

### Layer Structure

```
┌─────────────────────────────────┐
│ System Prompt                   │  Role, constraints, tools, format
├─────────────────────────────────┤
│ Context (retrieved/injected)    │  RAG results, user profile, state
├─────────────────────────────────┤
│ Conversation History            │  Prior messages (if conversational)
├─────────────────────────────────┤
│ Examples (few-shot)             │  Input/output pairs
├─────────────────────────────────┤
│ User Query                      │  The actual request
├─────────────────────────────────┤
│ Output Priming (optional)       │  Start of expected response format
└─────────────────────────────────┘
```

### Token Budget Allocation

| Component | Typical Budget | Priority |
|-----------|---------------|----------|
| System prompt | 200-800 tokens | Critical (always present) |
| Retrieved context | 2000-8000 tokens | High (task-dependent) |
| Conversation history | 1000-4000 tokens | Medium (summarize if long) |
| Few-shot examples | 500-2000 tokens | Medium (can reduce) |
| User query | 50-500 tokens | Critical (never truncate) |
| Output budget | 500-4000 tokens | Critical (reserve space) |

---

## System Prompt Patterns

### Role Assignment

```
You are a senior tax accountant with 15 years of experience.
You specialize in US corporate tax law and international tax treaties.

Your job: analyze tax implications and provide actionable advice.

Rules:
- Always cite the specific tax code section (e.g., IRC Section 179)
- Flag when you're uncertain and recommend consulting a CPA
- Never provide advice on tax evasion
- If asked about jurisdictions you don't cover, say so
```

### Constraint Setting

```
Rules:
- Respond in 3 sentences or fewer unless the user asks for detail
- Use bullet points for lists of 3+ items
- Include a confidence level (high/medium/low) with every answer
- If the question is outside your expertise, say "I don't have expertise in this area"
- Never make up citations or statistics
```

### Output Format Specification

```
Respond in the following JSON format:
{
  "answer": "Your answer here",
  "confidence": "high | medium | low",
  "sources": ["source1", "source2"],
  "caveats": ["any important limitations"],
  "follow_up_questions": ["suggested next questions"]
}
```

---

## Few-Shot Patterns

### Classification

```
Classify the customer message into one of: billing, technical, account, general.

Message: "I was charged twice for my subscription"
Category: billing

Message: "The API returns a 500 error when I upload files"
Category: technical

Message: "How do I change my email address?"
Category: account

Message: "{user_input}"
Category:
```

### Extraction

```
Extract structured data from the product review.

Review: "Great laptop! The 16GB RAM handles my dev work perfectly. Battery lasts about 6 hours. Only downside is the 1.8kg weight."
Extracted: {"product": "laptop", "ram": "16GB", "battery_life": "6 hours", "weight": "1.8kg", "sentiment": "positive", "cons": ["weight"]}

Review: "{user_review}"
Extracted:
```

### Style Transfer

```
Rewrite the technical message for a non-technical audience.

Technical: "The API endpoint is rate-limited to 100 req/s with exponential backoff on 429 responses."
Simple: "You can make up to 100 requests per second. If you exceed that, the system will ask you to wait before trying again, with increasingly longer wait times."

Technical: "{technical_text}"
Simple:
```

---

## Chain-of-Thought Patterns

### Basic CoT

```
Solve the problem step by step, showing your reasoning at each stage.

Problem: {problem}

Let me think through this step by step:
1. First, I need to understand...
2. Then, I should consider...
3. Based on that...
4. Therefore, the answer is...
```

### Self-Consistency

Generate N reasoning paths (temperature=0.7 for diversity), extract the final answer from each, and majority-vote. Reduces variance on math, logic, and classification tasks.

### Structured Reasoning

```
Analyze this code for security vulnerabilities.

Use this framework:
1. IDENTIFY: What does this code do? What data does it handle?
2. ATTACK SURFACE: What are the entry points? What can an attacker control?
3. VULNERABILITIES: What specific vulnerabilities exist? (reference CWE IDs)
4. SEVERITY: Rate each vulnerability (Critical/High/Medium/Low) with justification
5. REMEDIATION: Provide specific code fixes for each vulnerability

Code:
{code}
```

---

## Tool Use Patterns

### Tool Definition

```
You have access to the following tools:

search(query: string) -> list[{title, snippet, url}]
  Search the knowledge base for relevant documents.
  Use when: you need factual information you don't have.

calculate(expression: string) -> number
  Evaluate a mathematical expression.
  Use when: you need precise calculations.

get_user(user_id: string) -> {name, email, plan, created_at}
  Look up user details by ID.
  Use when: you need information about a specific user.

To use a tool, write:
Action: tool_name(arguments)

Wait for the result before continuing. You can use multiple tools in sequence.
Do not make up tool results -- wait for the actual response.
```

### ReAct Pattern

```
Answer the user's question using the available tools.

Format your response as:
Thought: [your reasoning about what to do next]
Action: [tool_name(arguments)]
Observation: [tool result will be inserted here]
... (repeat Thought/Action/Observation as needed)
Thought: I now have enough information to answer.
Answer: [your final answer to the user]

Rules:
- Always think before acting
- Use the minimum number of tool calls needed
- If a tool fails, try an alternative approach
- Never fabricate an Observation -- wait for the real result
```

### Parallel Tool Use

```
You can call multiple tools simultaneously when the calls are independent.

Example:
Thought: I need both the user's profile and their recent orders.
Actions:
  - get_user("u123")
  - get_orders("u123", limit=5)

[Both results returned]

Thought: Now I can answer with complete information.
Answer: ...
```

---

## Structured Output Patterns

### JSON Mode

```
Extract the following information from the text. Respond with valid JSON only.

Schema:
{
  "company_name": string,
  "revenue": number | null,
  "currency": string,
  "year": number,
  "growth_rate": number | null,
  "sentiment": "positive" | "negative" | "neutral"
}

Text: {input_text}
```

### TypeScript Schema

```
Respond with a TypeScript-typed object:

interface AnalysisResult {
  summary: string;                    // 1-2 sentence summary
  key_findings: string[];             // 3-5 key findings
  risk_level: "low" | "medium" | "high" | "critical";
  recommendations: {
    action: string;
    priority: "p0" | "p1" | "p2";
    effort: "small" | "medium" | "large";
  }[];
  confidence: number;                 // 0.0 to 1.0
}
```

### Markdown Format

```
Format your response using this template:

## Summary
[1-2 sentences]

## Analysis
[Detailed analysis with bullet points]

## Recommendations
| # | Action | Priority | Effort |
|---|--------|----------|--------|
| 1 | ...    | ...      | ...    |

## Next Steps
- [ ] First action item
- [ ] Second action item
```

---

## Safety and Guardrails

### Input Sanitization

```python
def sanitize_user_input(user_input):
    """Remove common prompt injection patterns."""
    # Check length
    if len(user_input) > MAX_INPUT_LENGTH:
        raise ValueError("Input too long")

    # Detect injection patterns
    injection_patterns = [
        r"ignore (?:previous|above|all) instructions",
        r"you are now",
        r"system prompt",
        r"reveal your",
        r"forget (?:everything|your rules)",
    ]

    for pattern in injection_patterns:
        if re.search(pattern, user_input, re.IGNORECASE):
            log.warning(f"Potential injection detected: {pattern}")
            return "[Content filtered for safety]"

    return user_input
```

### Output Validation

```python
def validate_llm_output(output, context):
    """Check LLM output for safety issues."""
    checks = []

    # PII detection
    pii_patterns = {
        "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
        "credit_card": r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b",
        "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
    }

    for pii_type, pattern in pii_patterns.items():
        if re.search(pattern, output):
            checks.append(f"PII detected: {pii_type}")

    # Hallucination check (is output grounded in context?)
    if context:
        grounding_score = check_grounding(output, context)
        if grounding_score < 0.5:
            checks.append("Low grounding score -- possible hallucination")

    return {"safe": len(checks) == 0, "issues": checks}
```

### Grounding Check

Use an LLM to rate how well an answer is supported by provided context (0.0 to 1.0). If score < 0.5, flag as possible hallucination.

---

## Prompt Testing

### Test Categories

Test six categories: **happy path** (standard queries produce correct output), **edge cases** (empty/very long input), **adversarial** (injection/jailbreak attempts), **format compliance** (output matches schema), **consistency** (same input 5x, check variance), **refusal** (correctly refuses out-of-scope).

### Automated Testing

For each test case: format prompt, generate output, check `format_valid`, `content_match` (semantic similarity > 0.8), and `no_pii`. Calculate pass rate across the suite. Version prompts in directories (`v1/`, `v2/`) with `system.txt`, `examples.json`, `eval_results.json`. Symlink `active -> v2/`. Track changes like code: version, test, compare metrics, deploy.

---

## Advanced Prompt Patterns

### Prompt Scaffolding (Defensive Prompting)

Wrap user inputs in XML-tagged templates with `<allowed_topics>`, `<forbidden_topics>`, and a rule to ignore instructions embedded in user messages. Separate `<system>` from `<user_message>`.

### Prompt Chaining

Break complex tasks into sequential prompts (extract -> verify -> synthesize). Each step has clear input/output, is easier to debug, and can use different models.

### Structured Prefill / Output Priming

Start the assistant response to steer format (e.g., prefill `{"bugs": [` to force JSON output).

### Context Engineering

1. **Summarize long contexts** -- compress conversation history before including
2. **Structured context injection** -- pass retrieved docs as tagged blocks with metadata
3. **Priority ordering** -- place most critical context at start and end (U-shaped attention)
4. **Token budget allocation** -- reserve output tokens, never exceed 80% of context window
