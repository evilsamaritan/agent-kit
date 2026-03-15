# UX Design Patterns Reference

Universal UX patterns for designing effective, inclusive user experiences.

## Contents

- [Interaction Patterns](#interaction-patterns)
- [Journey Mapping Templates](#journey-mapping-templates)
- [Cognitive Load Patterns](#cognitive-load-patterns)
- [Empty State Design](#empty-state-design)
- [Error Recovery Patterns](#error-recovery-patterns)
- [Feedback Loops](#feedback-loops)

---

## Interaction Patterns

### Click & Tap Affordances

| Element | Affordance Signal | Anti-Pattern |
|---------|------------------|--------------|
| Button | Raised/filled appearance, cursor: pointer, hover state | Flat text that is actually clickable |
| Link | Underline or color differentiation, visited state | Styled identically to body text |
| Card (clickable) | Hover elevation change, cursor: pointer on entire surface | Click target only on title text |
| Toggle | Distinct on/off states, thumb movement direction | Ambiguous middle state |
| Drag handle | Grip dots/lines icon, cursor: grab | No visual indicator of draggability |

### Hover Interactions

- **Tooltips**: appear after 300-500ms delay, dismiss on mouse leave, never hide critical info behind hover
- **Preview cards**: show supplementary data on hover, must also be accessible via click/focus
- **Hover states**: subtle background change to confirm interactivity, never change layout on hover
- **Rule**: every hover interaction must have a non-hover equivalent (touch devices have no hover)

### Drag & Drop

- **Visual cues during drag**: ghost element showing what's being moved, drop zone highlighting
- **Constraints**: restrict to valid drop zones, show forbidden zones clearly
- **Keyboard alternative**: always provide select-then-move or arrow key reordering
- **Feedback**: animate item into new position, show confirmation of reorder

### Gesture Patterns (Touch)

| Gesture | Common Use | Must Also Support |
|---------|-----------|-------------------|
| Swipe left/right | Delete, archive, reveal actions | Button alternative visible or discoverable |
| Pull to refresh | Reload content | Visible refresh button |
| Pinch to zoom | Image/map zoom | Zoom controls (+/- buttons) |
| Long press | Context menu, selection mode | Right-click or visible menu trigger |

**Rule**: gestures are shortcuts, not the only path. Every gesture must have a visible, tappable alternative.

---

## Journey Mapping Templates

### Task Flow Analysis Framework

For any user task, map these elements:

```
TRIGGER → STEPS → OUTCOME
  ↓         ↓        ↓
What       Each     Success
prompts    action   state &
the task   needed   error states
```

### Step-by-Step Mapping

For each step in a user journey, document:

| Step | User Intent | Action Required | Feedback Given | Potential Friction | Recovery Path |
|------|-------------|----------------|----------------|--------------------|---------------|
| 1 | "I want to..." | Click/type/select... | What confirms progress | What could go wrong | How to fix/retry |

### State Transition Map

Every screen or component exists in one of these states. All must be designed:

| State | Description | Design Requirements |
|-------|-------------|-------------------|
| **Empty** | No data exists yet | Explain why empty, show how to add data, illustration optional |
| **Loading** | Data is being fetched | Skeleton matching final layout, progress indicator if >2s |
| **Partial** | Some data loaded, more available | Show what's available, indicate more exists, load-more trigger |
| **Ideal** | Full data, everything works | The "happy path" design everyone starts with |
| **Error** | Something failed | What failed, why, how to fix, retry action |
| **Stale** | Data may be outdated | Freshness indicator, manual refresh option |
| **Forbidden** | User lacks permission | What they can't do, why, how to get access |

### Onboarding Journey Patterns

| Pattern | When to Use | Implementation |
|---------|-------------|----------------|
| **Contextual tips** | Feature is discoverable but non-obvious | Tooltip/popover on first encounter, dismissible |
| **Empty state guidance** | First-time user sees blank screen | Inline instructions + CTA within the empty state |
| **Progressive reveal** | Complex tool with learning curve | Unlock features as user demonstrates competency |
| **Checklist** | Multi-step setup required | Persistent progress checklist with completion state |
| **Sample data** | User needs to see value before investing | Pre-populated example they can explore then clear |

---

## Cognitive Load Patterns

### Visual Hierarchy Principles

Establish reading order through these tools (in order of impact):

1. **Size**: larger elements draw attention first
2. **Contrast**: high-contrast elements stand out from surroundings
3. **Color**: semantic color (red for errors, green for success) guides interpretation
4. **Position**: top-left (LTR) or top-right (RTL) gets scanned first
5. **Whitespace**: isolation draws attention (surrounded by space = important)
6. **Typography weight**: bold text within regular text creates emphasis

### Chunking Strategies

| Content Type | Chunking Method | Example |
|-------------|-----------------|---------|
| Long form | Section headers + paragraphs | Settings page with categorized groups |
| Lists | Group by category, max 5-7 visible items | Navigation menu with sections |
| Data tables | Row grouping, pagination, or virtual scroll | Transactions grouped by date |
| Forms | Multi-step wizard or fieldset grouping | Checkout: shipping → payment → review |
| Dashboards | Card-based layout with clear section labels | Metrics section, activity section, alerts section |

### Recognition Over Recall

| Recall (Bad) | Recognition (Good) |
|-------------|-------------------|
| Blank text input for commands | Dropdown with searchable options |
| "Enter the code" | "Select from recent codes" with history |
| Memorize keyboard shortcuts | Command palette with searchable actions |
| Remember where a setting lives | Search/filter within settings |
| Type exact filter syntax | Visual filter builder with dropdowns |

### Hick's Law Application

Reduce decision time by limiting choices:

| Scenario | Too Many Choices | Better Approach |
|----------|-----------------|-----------------|
| Primary action | 5 equal-weight buttons | 1 primary + secondary + overflow menu |
| Navigation | 15+ top-level items | 5-7 top-level, rest in sub-navigation |
| Settings | All options on one page | Categorized sections, search within settings |
| Data actions | Row of action buttons per item | Primary action visible, rest in dropdown |
| Onboarding | Every feature shown at once | Progressive disclosure over first sessions |

---

## Empty State Design

### Anatomy of a Good Empty State

Every empty state should contain:

1. **Illustration or icon** (optional but recommended): visual context, not decorative
2. **Headline**: what this area will contain ("No projects yet")
3. **Description**: why it's empty and what value filling it provides
4. **Primary CTA**: the action to create/add/import the first item
5. **Secondary option** (if applicable): import, connect, or learn more

### Empty State Types

| Type | Cause | Design Approach |
|------|-------|-----------------|
| **First use** | User hasn't created anything | Welcoming tone, clear CTA to create first item |
| **No results** | Search/filter returned nothing | Suggest broadening filters, show recent items |
| **Cleared** | User deleted/completed everything | Congratulatory or neutral, suggest next action |
| **Error** | Failed to load data | Error message + retry, not a blank screen |
| **Permission** | User can't access this content | Explain why, show how to request access |

### Anti-Patterns

- Blank white screen with no explanation
- "No data" text with no action path
- Hiding the entire section when empty (user can't discover features)
- Showing a generic empty state for all scenarios

---

## Error Recovery Patterns

### Error Message Anatomy

Every error message answers three questions:

1. **What happened?** — describe the problem in user terms (not technical jargon)
2. **Why did it happen?** — brief cause if it helps the user (optional)
3. **How to fix it** — actionable next step (retry, change input, contact support)

### Error Types and Recovery

| Error Type | Example | Recovery Pattern |
|-----------|---------|-----------------|
| **Validation** | "Email format invalid" | Inline field error, highlight field, describe valid format |
| **Network** | "Couldn't reach server" | Retry button + "Check your connection" |
| **Permission** | "You don't have access" | Request access link or explain how to get permission |
| **Not found** | "This page doesn't exist" | Search, go home, report if unexpected |
| **Conflict** | "Someone else edited this" | Show diff, offer merge or overwrite choice |
| **Rate limit** | "Too many requests" | Show wait time, auto-retry with countdown |
| **Timeout** | "Request took too long" | Retry button, suggest trying again later |

### Prevention Over Recovery

| Prevention Pattern | How It Works |
|-------------------|-------------|
| **Inline validation** | Validate on blur (not keystroke), show errors before submit |
| **Confirmation dialog** | "Are you sure?" with description of consequences for destructive actions |
| **Undo** | Allow reversal within time window instead of blocking with confirmation |
| **Autosave** | Save drafts automatically, prevent data loss |
| **Constraints** | Disable invalid options instead of allowing then rejecting |
| **Smart defaults** | Pre-fill with sensible values to reduce error opportunity |

---

## Feedback Loops

### Timing Guidelines

| Duration | User Perception | Feedback Needed |
|----------|----------------|-----------------|
| < 100ms | Instantaneous | None (direct manipulation) |
| 100ms - 1s | Slight delay | Cursor change, button state change |
| 1s - 5s | Noticeable wait | Spinner or progress bar |
| 5s - 10s | Long wait | Progress bar with percentage, skeleton screen |
| > 10s | Very long | Progress with estimate, allow background processing |

### Loading Feedback

| Pattern | When to Use | Anti-Pattern |
|---------|------------|--------------|
| **Skeleton screen** | Page/section initial load | Blank screen or spinner on empty page |
| **Inline spinner** | Button action, field validation | Full-page overlay for small action |
| **Progress bar** | File upload, multi-step process | Indeterminate spinner for known-duration tasks |
| **Optimistic update** | Toggle, like, simple state change | Waiting for server before showing any change |
| **Background indicator** | Auto-save, sync | No indication that save occurred |

### Success Feedback

| Action Type | Feedback Pattern |
|-------------|-----------------|
| **Create** | Navigate to new item, or show toast "Created successfully" |
| **Update** | Inline confirmation (checkmark, "Saved"), brief toast |
| **Delete** | Item removed from list + undo toast with timer |
| **Submit** | Confirmation page or state change (button → "Submitted") |
| **Bulk action** | Summary toast: "3 items archived" with undo |

### Error Feedback

| Context | Pattern |
|---------|---------|
| **Form field** | Red border + error message below field, icon optional |
| **Form submit** | Error summary at top + scroll to first error + field highlights |
| **API failure** | Toast or inline alert with retry action |
| **Background process** | Notification/badge indicating failure, details on click |
| **Real-time** | Status indicator change (green → red) + explanation |

### Progress Indicators

| Type | When | Requirements |
|------|------|-------------|
| **Determinate** | Duration/size is known | Show percentage, estimated time remaining |
| **Indeterminate** | Duration unknown | Spinner or pulsing bar, reassure that work is happening |
| **Segmented** | Multi-step process | Step indicator (Step 2 of 4), completed steps marked |
| **Streaming** | Incremental results | Show results as they arrive, indicate more coming |
