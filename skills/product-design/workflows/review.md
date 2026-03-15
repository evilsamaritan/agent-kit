# UX Review Workflow

Step-by-step procedure for conducting a full user experience review.

---

## Phase 1: UX Heuristic Evaluation (Nielsen's 10)

Evaluate the interface against Nielsen's 10 usability heuristics:

1. **Visibility of system status**
   - [ ] System keeps user informed about what's happening (loading, saving, errors)
   - [ ] Response times are communicated (progress indicators for waits >1s)
   - [ ] State changes are visible and understandable

2. **Match between system and real world**
   - [ ] Language uses user's vocabulary, not developer jargon
   - [ ] Information appears in natural and logical order
   - [ ] Icons and metaphors match user mental models

3. **User control and freedom**
   - [ ] Undo/redo available for significant actions
   - [ ] "Emergency exits" clearly marked (cancel, back, close)
   - [ ] Users can navigate freely without forced sequences

4. **Consistency and standards**
   - [ ] Same action, same result across the entire interface
   - [ ] Platform conventions followed (link style, button placement, form patterns)
   - [ ] Terminology is consistent throughout

5. **Error prevention**
   - [ ] Confirmation for destructive actions (delete, overwrite)
   - [ ] Constraints prevent invalid input where possible
   - [ ] Inline validation catches errors before submission

6. **Recognition rather than recall**
   - [ ] Options visible, not hidden behind memorization
   - [ ] Recent items, suggestions, and defaults reduce memory burden
   - [ ] Help and context available where needed

7. **Flexibility and efficiency of use**
   - [ ] Shortcuts available for expert users (keyboard shortcuts, bulk actions)
   - [ ] Customization options for frequent tasks
   - [ ] Progressive disclosure balances novice and expert needs

8. **Aesthetic and minimalist design**
   - [ ] No irrelevant information competing with relevant information
   - [ ] Visual hierarchy directs attention to primary content and actions
   - [ ] Whitespace used effectively to reduce visual noise

9. **Help users recognize, diagnose, and recover from errors**
   - [ ] Error messages in plain language (no codes or technical jargon)
   - [ ] Error messages describe the problem AND suggest a solution
   - [ ] Recovery path is clear (retry, edit, contact support)

10. **Help and documentation**
    - [ ] Contextual help available where tasks are complex
    - [ ] Documentation searchable and task-oriented
    - [ ] Onboarding guides first-time users through key flows

---

## Phase 2: Task Flow Analysis

Map the primary user journeys through the application:

1. **Identify core tasks** — what are the 3-5 things users do most often?
2. **Map each task flow**:
   - Entry point: how does the user start this task?
   - Steps: what actions are required at each stage?
   - Decision points: where must the user make a choice?
   - Feedback: what confirmation does the user receive at each step?
   - Completion: how does the user know the task is done?
3. **Identify friction points**:
   - [ ] Unnecessary steps that could be eliminated or combined
   - [ ] Dead ends where the user has no clear next action
   - [ ] Ambiguous choices where the user might hesitate
   - [ ] Missing feedback where the user doesn't know what happened
   - [ ] Context switches that break the user's flow (new tab, page reload, modal)
4. **Evaluate state coverage**:
   - [ ] Empty state designed and helpful (not blank screen)
   - [ ] Loading state present with appropriate indicator
   - [ ] Error state actionable with recovery path
   - [ ] Partial/incomplete state handled gracefully
   - [ ] Success state provides confirmation and next steps

---

## Phase 3: Cognitive Load Assessment

Evaluate whether the interface respects human cognitive limits:

1. **Visual hierarchy audit**:
   - [ ] Clear primary, secondary, and tertiary content levels
   - [ ] Most important information visible without scrolling
   - [ ] Size, contrast, and position guide the eye through content in order
   - [ ] Whitespace separates groups and reduces visual noise

2. **Information chunking**:
   - [ ] No more than 5-7 items in any ungrouped list or navigation
   - [ ] Long content broken into scannable sections with headers
   - [ ] Related items visually grouped together
   - [ ] Forms divided into logical fieldsets or steps

3. **Decision complexity**:
   - [ ] Primary action visually distinct from secondary actions
   - [ ] No more than one primary action per screen/section
   - [ ] Options presented progressively (not all at once)
   - [ ] Defaults provided for common choices

4. **Recognition support**:
   - [ ] Frequently used items easily accessible (recent, favorites, pinned)
   - [ ] Autocomplete and suggestions reduce typing and recall burden
   - [ ] Actions labeled with verbs ("Save changes" not just "Save")
   - [ ] Consistent iconography — same icon means same action everywhere

---

## Phase 4: Accessibility Review (as UX)

Evaluate accessibility as a user experience concern, not just compliance:

1. **Keyboard experience**:
   - [ ] All functionality reachable via keyboard alone
   - [ ] Tab order follows visual reading order
   - [ ] Focus indicator clearly visible on all interactive elements
   - [ ] Focus trapped in modals/drawers, restored on close
   - [ ] Skip-to-main-content link present

2. **Screen reader narrative**:
   - [ ] Page has clear heading hierarchy (h1 → h2 → h3, no skipping levels)
   - [ ] Dynamic content updates announced via aria-live regions
   - [ ] Icon-only buttons have descriptive aria-labels
   - [ ] Form inputs associated with visible labels
   - [ ] Status changes communicated (not just visual color change)

3. **Visual accessibility**:
   - [ ] Text contrast >= 4.5:1 normal, >= 3:1 large text (WCAG AA)
   - [ ] UI component contrast >= 3:1 against background
   - [ ] Color is never the sole means of conveying information
   - [ ] Content readable at 200% zoom without horizontal scrolling
   - [ ] Animations respect prefers-reduced-motion

4. **Cognitive accessibility**:
   - [ ] Language is plain and direct (no jargon, abbreviations explained)
   - [ ] Navigation is predictable and consistent across pages
   - [ ] Error messages explain what to do, not just what went wrong
   - [ ] Time limits are generous or adjustable (session timeouts, auto-dismiss)
   - [ ] Critical actions can be undone or confirmed before execution

5. **Motor accessibility**:
   - [ ] Touch targets >= 44x44px for interactive elements
   - [ ] Adequate spacing between interactive elements (no accidental taps)
   - [ ] Drag-and-drop has keyboard alternative
   - [ ] Complex gestures have simple alternatives

---

## Phase 5: Information Architecture Review

Evaluate the organization, labeling, and navigation of content:

1. **Navigation structure**:
   - [ ] Primary navigation reflects top-level user tasks (not internal org structure)
   - [ ] Current location clearly indicated (active states, breadcrumbs)
   - [ ] Navigation is consistent across pages (same position, same items)
   - [ ] Depth is appropriate (most content reachable within 3 clicks)
   - [ ] Mobile navigation adaptation makes sense (sidebar → drawer/bottom nav)

2. **Labeling and terminology**:
   - [ ] Labels describe content from user's perspective (not developer/business terms)
   - [ ] Terminology is consistent across navigation, headings, buttons, and messages
   - [ ] Abbreviations and acronyms are explained on first use
   - [ ] Action labels use specific verbs ("Create project" not "Submit")

3. **Content grouping**:
   - [ ] Related items are near each other
   - [ ] Unrelated items are visually separated
   - [ ] Groups are labeled clearly
   - [ ] Hierarchy is evident (primary > secondary > tertiary content)

4. **Search and filtering**:
   - [ ] Search available when content exceeds ~20 items
   - [ ] Filters are relevant to user's mental model of the content
   - [ ] Active filters are visible and removable
   - [ ] No-results state suggests alternatives (broaden search, clear filters)

---

## Phase 6: Design System Consistency Audit

Evaluate whether UX patterns are applied consistently:

1. **Token and pattern usage**:
   - [ ] Semantic tokens used instead of hardcoded values (colors, spacing, typography)
   - [ ] Same semantic intent uses the same token (all errors use destructive color, etc.)
   - [ ] Component variants follow a unified system (not ad-hoc per component)
   - [ ] Spacing follows a consistent scale (4px/8px grid)

2. **Interaction consistency**:
   - [ ] Similar components behave the same way throughout the app
   - [ ] Feedback patterns are consistent (toasts for transient, alerts for persistent)
   - [ ] Confirmation patterns match across destructive actions
   - [ ] Loading patterns are consistent (skeleton vs spinner usage)

3. **Component API discipline**:
   - [ ] Components compose from primitives (not monolithic custom builds)
   - [ ] Variant naming is systematic and predictable
   - [ ] Components from the library are used as-is (not reimplemented)
   - [ ] Customization happens through theme/tokens, not overrides

4. **Status and state consistency**:
   - [ ] Status colors/icons map consistently across all entities
   - [ ] Empty, loading, and error states exist for all data-dependent views
   - [ ] Disabled states explain why (tooltip or adjacent text)

---

## Produce Report

Use this structure for the final report:

```
## UX Review

### Summary
[2-3 sentences: overall UX maturity, key strengths, critical gaps]

### Core Task Flows
| Task | Steps | Friction Points | Missing States |
|------|-------|-----------------|----------------|

### Heuristic Scores
| Heuristic | Score (1-5) | Key Finding |
|-----------|-------------|-------------|
| Visibility of system status | | |
| Match with real world | | |
| User control and freedom | | |
| Consistency and standards | | |
| Error prevention | | |
| Recognition over recall | | |
| Flexibility and efficiency | | |
| Aesthetic and minimalist design | | |
| Error recovery | | |
| Help and documentation | | |

### Cognitive Load Assessment
| Area | Rating | Finding |
|------|--------|---------|
| Visual hierarchy | | |
| Information chunking | | |
| Decision complexity | | |
| Recognition support | | |

### Accessibility (UX Perspective)
| Area | Rating | Finding |
|------|--------|---------|
| Keyboard experience | | |
| Screen reader narrative | | |
| Visual accessibility | | |
| Cognitive accessibility | | |
| Motor accessibility | | |

### Information Architecture
| Area | Rating | Finding |
|------|--------|---------|
| Navigation structure | | |
| Labeling and terminology | | |
| Content grouping | | |
| Search and filtering | | |

### Design System Consistency
| Area | Rating | Finding |
|------|--------|---------|
| Token usage | | |
| Interaction consistency | | |
| Component API discipline | | |
| Status/state consistency | | |

### Findings
| # | Severity | Area | Finding | Recommendation |
|---|----------|------|---------|----------------|

### Priority Actions
1. [Most impactful improvements, ordered by effort-to-impact ratio]
```
