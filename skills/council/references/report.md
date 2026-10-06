# Council Artifacts

Every session writes two files, by default to the working directory. The procedure that writes them is step 5 of [run.md](../workflows/run.md).

```
council-report-<YYYYMMDD-HHMMSS>.html       # visual briefing
council-transcript-<YYYYMMDD-HHMMSS>.md     # full audit trail
```

Same timestamp for both files. ISO-style timestamps so filename sort = chronological order.

---

## HTML report — use the template

**Do not hand-author the HTML.** A finished template lives at [assets/report-template.html](../assets/report-template.html). Read it, substitute the placeholders below, and write the result to `council-report-<timestamp>.html`.

This is deliberate: every council report must look identical across sessions so the user can scan a series of them without recalibrating. No redesign. No per-session personality. No "let me improve the layout this time."

### Substitution table

| Placeholder | Content | HTML-escape? |
|-------------|---------|--------------|
| `{{TITLE}}` | First 60 chars of the framed question, single line, ellipsis if truncated | yes |
| `{{TIMESTAMP_HUMAN}}` | Human-readable date+time, e.g. `17 May 2026 · 13:52` (appears in header and footer) | no |
| `{{FRAMED_QUESTION_HTML}}` | Framed question, paragraphs preserved as `<p>...</p>` | yes (then wrap in `<p>`) |
| `{{VERDICT_AGREES_HTML}}` | Chair's "Where the council agrees" body, as `<p>` paragraphs | yes |
| `{{VERDICT_CLASHES_HTML}}` | Chair's "Where the council clashes" body | yes |
| `{{VERDICT_BLIND_SPOTS_HTML}}` | Chair's "Blind spots the council caught" body | yes |
| `{{VERDICT_RECOMMENDATION_HTML}}` | Chair's "The recommendation" body | yes |
| `{{VERDICT_NEXT_STEP_HTML}}` | Chair's "The one thing to do first" body — **must be one item, not a list** | yes |
| `{{ALIGNED_ON}}` | One-sentence summary of consensus points (derived from "agrees") | yes |
| `{{DIVERGED_ON}}` | One-sentence summary of clash points (derived from "clashes") | yes |
| `{{RESPONSE_CONTRARIAN_HTML}}` | Full Contrarian response, paragraphs as `<p>` | yes |
| `{{RESPONSE_FIRST_PRINCIPLES_HTML}}` | Full First Principles response | yes |
| `{{RESPONSE_EXPANSIONIST_HTML}}` | Full Expansionist response | yes |
| `{{RESPONSE_OUTSIDER_HTML}}` | Full Outsider response | yes |
| `{{RESPONSE_EXECUTOR_HTML}}` | Full Executor response | yes |
| `{{PEER_REVIEW_BLOCKS_HTML}}` | Five reviewer blocks concatenated (see format below) | yes |
| `{{TRANSCRIPT_FILENAME}}` | `council-transcript-<same-timestamp>.md` | no |

### HTML-escaping rule

Before substitution, run each user-supplied string through:

```
&  →  &amp;
<  →  &lt;
>  →  &gt;
"  →  &quot;
```

Apply `&amp;` first so it doesn't double-escape the others. Advisor responses are model output and can contain stray angle brackets; escaping is mandatory.

### Paragraph wrapping

Sub-agent responses come back as plain text with blank-line paragraph breaks. Convert each paragraph to `<p>...</p>` so spacing renders correctly inside the template's content blocks. Do not introduce `<br>`, `<div>`, or other tags — paragraphs only.

### Peer review block format

For each of the 5 reviewers, generate:

```html
<div class="review-block">
  <h4>Reviewer N</h4>
  <p>{review text, HTML-escaped, paragraphs wrapped}</p>
</div>
```

Concatenate all 5 blocks into `{{PEER_REVIEW_BLOCKS_HTML}}`. The anonymization mapping (A→advisor) is **not** rendered in the HTML — that belongs only in the transcript.

---

## Editing the template

The template lives at `assets/report-template.html`. If you genuinely need to change the design (rare), edit the template itself, not the report. Anything that lives in the template applies to every future council session uniformly.

Don't add:
- Navigation bars, sidebars, tables of contents
- Per-advisor avatars, badges, or color coding
- Charts, confidence scores, share buttons
- Auto-theme switching, `prefers-color-scheme` media queries
- JavaScript dependencies (the template uses native `<details>` only)

The aesthetic target: a calm, professional briefing memo. Not a landing page, a code editor, or a portfolio.

---

## Markdown transcript

The transcript is utilitarian — plain Markdown, no template needed. It's the auditable record.

```markdown
# Council Transcript — <YYYY-MM-DD HH:MM:SS>

## Original question

> <user's raw question as typed>

## Framed question

> <neutral, context-enriched framing sent to advisors>

### Context used

- <file paths read while framing the question>

---

## Advisor responses

### The Contrarian
<response>

### The First Principles Thinker
<response>

### The Expansionist
<response>

### The Outsider
<response>

### The Executor
<response>

---

## Peer review

**Anonymization mapping:**
- A = <advisor name>
- B = <advisor name>
- C = <advisor name>
- D = <advisor name>
- E = <advisor name>

### Reviewer 1
<review>

### Reviewer 2
<review>

### Reviewer 3
<review>

### Reviewer 4
<review>

### Reviewer 5
<review>

---

## Chair synthesis

<full chair output verbatim — preserve the 5 fixed headers>

---

```

The transcript reveals the anonymization mapping. The HTML report does NOT — the mapping is an audit detail, not user-facing. Preserve the chair's output verbatim. Don't reformat — the verdict structure is part of the methodology.

When the same decision comes back, the framing step reads earlier transcripts so the council does not repeat settled ground.
