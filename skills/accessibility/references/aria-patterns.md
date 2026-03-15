# ARIA Patterns

Full interaction patterns for common components. Each pattern includes role, states, properties, and keyboard interaction.

## Contents

- [Dialog (Modal)](#dialog-modal)
- [Tabs](#tabs)
- [Menu](#menu)
- [Combobox (Autocomplete)](#combobox-autocomplete)
- [Tree View](#tree-view)
- [Accordion](#accordion)
- [Data Table](#data-table)
- [Tooltip](#tooltip)

---

## Dialog (Modal)

**Preferred:** Use `<dialog>` with `showModal()` — built-in focus trap, Escape, and backdrop.

```html
<dialog id="confirm-dialog" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm deletion</h2>
  <p>Are you sure you want to delete this item? This cannot be undone.</p>
  <div class="dialog-actions">
    <button data-action="cancel">Cancel</button>
    <button data-action="confirm" autofocus>Delete</button>
  </div>
</dialog>
```

```typescript
const dialog = document.getElementById("confirm-dialog") as HTMLDialogElement;
const trigger = document.getElementById("delete-btn")!;

trigger.addEventListener("click", () => dialog.showModal());
dialog.addEventListener("close", () => trigger.focus()); // Return focus

dialog.addEventListener("click", (e) => {
  // Close on backdrop click
  if (e.target === dialog) dialog.close();
});
```

**Keyboard:**

| Key | Action |
|-----|--------|
| Tab | Cycle through focusable elements inside dialog |
| Shift+Tab | Reverse cycle |
| Escape | Close dialog |

**Rules:**
- Set initial focus to first interactive element, or `autofocus` on primary action
- Return focus to trigger element on close
- Prevent scroll of background content

---

## Tabs

```html
<div class="tabs">
  <div role="tablist" aria-label="Account settings">
    <button role="tab" id="tab-1" aria-selected="true" aria-controls="panel-1" tabindex="0">
      Profile
    </button>
    <button role="tab" id="tab-2" aria-selected="false" aria-controls="panel-2" tabindex="-1">
      Security
    </button>
    <button role="tab" id="tab-3" aria-selected="false" aria-controls="panel-3" tabindex="-1">
      Billing
    </button>
  </div>

  <div role="tabpanel" id="panel-1" aria-labelledby="tab-1" tabindex="0">
    Profile content...
  </div>
  <div role="tabpanel" id="panel-2" aria-labelledby="tab-2" tabindex="0" hidden>
    Security content...
  </div>
  <div role="tabpanel" id="panel-3" aria-labelledby="tab-3" tabindex="0" hidden>
    Billing content...
  </div>
</div>
```

**Keyboard:**

| Key | Action |
|-----|--------|
| Arrow Right | Next tab |
| Arrow Left | Previous tab |
| Home | First tab |
| End | Last tab |
| Tab | Move focus to tab panel |

**Activation:** Automatic (focus = activate) or manual (focus, then Enter/Space to activate). Automatic is preferred for fast switching.

---

## Menu

```html
<div class="menu-wrapper">
  <button id="menu-btn" aria-haspopup="true" aria-expanded="false" aria-controls="action-menu">
    Actions
  </button>

  <ul id="action-menu" role="menu" aria-labelledby="menu-btn" hidden>
    <li role="menuitem" tabindex="-1">Edit</li>
    <li role="menuitem" tabindex="-1">Duplicate</li>
    <li role="separator"></li>
    <li role="menuitem" tabindex="-1">Delete</li>
  </ul>
</div>
```

**Keyboard:**

| Key | Action |
|-----|--------|
| Enter/Space | Open menu, focus first item |
| Arrow Down | Next item (wraps) |
| Arrow Up | Previous item (wraps) |
| Home | First item |
| End | Last item |
| Escape | Close menu, return focus to trigger |
| Character key | Focus item starting with that character |

**Rules:**
- Menu opens on click or Enter/Space, not on hover
- First item receives focus when menu opens
- `aria-expanded` on trigger reflects state

---

## Combobox (Autocomplete)

```html
<label for="city-input">City</label>
<div class="combobox-wrapper">
  <input
    id="city-input"
    role="combobox"
    type="text"
    aria-expanded="false"
    aria-autocomplete="list"
    aria-controls="city-listbox"
    aria-activedescendant=""
  />
  <ul id="city-listbox" role="listbox" hidden>
    <li id="city-1" role="option">New York</li>
    <li id="city-2" role="option">Los Angeles</li>
    <li id="city-3" role="option">Chicago</li>
  </ul>
</div>
```

**Keyboard:**

| Key | Action |
|-----|--------|
| Arrow Down | Open list / next option |
| Arrow Up | Previous option |
| Enter | Select highlighted option |
| Escape | Close list, clear selection |
| Typing | Filter options |

**States:**
- `aria-expanded` — list is visible
- `aria-activedescendant` — ID of currently highlighted option
- `aria-selected="true"` — on the selected option

---

## Tree View

```html
<ul role="tree" aria-label="File browser">
  <li role="treeitem" aria-expanded="true">
    <span>Documents</span>
    <ul role="group">
      <li role="treeitem" class="leaf">report.pdf</li>
      <li role="treeitem" aria-expanded="false">
        <span>Photos</span>
        <ul role="group">
          <li role="treeitem" class="leaf">vacation.jpg</li>
        </ul>
      </li>
    </ul>
  </li>
  <li role="treeitem" class="leaf">readme.txt</li>
</ul>
```

**Keyboard:**

| Key | Action |
|-----|--------|
| Arrow Down | Next visible node |
| Arrow Up | Previous visible node |
| Arrow Right | Expand node / move to first child |
| Arrow Left | Collapse node / move to parent |
| Home | First node |
| End | Last visible node |
| Enter | Activate node |
| * | Expand all siblings |

---

## Accordion

```html
<div class="accordion">
  <h3>
    <button aria-expanded="true" aria-controls="section-1-content" id="section-1-header">
      Section 1
    </button>
  </h3>
  <div id="section-1-content" role="region" aria-labelledby="section-1-header">
    <p>Content for section 1...</p>
  </div>

  <h3>
    <button aria-expanded="false" aria-controls="section-2-content" id="section-2-header">
      Section 2
    </button>
  </h3>
  <div id="section-2-content" role="region" aria-labelledby="section-2-header" hidden>
    <p>Content for section 2...</p>
  </div>
</div>
```

**Alternative:** Use `<details>`/`<summary>` for simple accordions — native semantics, no ARIA needed.

```html
<details>
  <summary>Section 1</summary>
  <p>Content for section 1...</p>
</details>
```

**Keyboard:**

| Key | Action |
|-----|--------|
| Enter/Space | Toggle section |
| Tab | Move between headers |

---

## Data Table

```html
<table role="table" aria-label="Employee directory">
  <thead>
    <tr>
      <th scope="col" aria-sort="ascending">
        <button>Name</button>
      </th>
      <th scope="col" aria-sort="none">
        <button>Department</button>
      </th>
      <th scope="col">Email</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Alice Johnson</td>
      <td>Engineering</td>
      <td><a href="mailto:alice@example.com">alice@example.com</a></td>
    </tr>
  </tbody>
</table>

<!-- Live region for sort announcements -->
<div aria-live="polite" class="sr-only">
  Sorted by name, ascending
</div>
```

**Sortable columns:**
- `aria-sort="ascending"`, `"descending"`, `"none"` on `<th>`
- Announce sort change via live region
- Only one column sorted at a time

**Rules:**
- `<th scope="col">` for column headers, `<th scope="row">` for row headers
- `<caption>` or `aria-label` for table purpose
- Don't use tables for layout

---

## Tooltip

```html
<!-- Tooltip on hover/focus — informational only, no interactive content -->
<button aria-describedby="tooltip-1">
  <svg aria-hidden="true">...</svg>
  Settings
</button>
<div id="tooltip-1" role="tooltip" class="tooltip">
  Configure application preferences
</div>
```

**Rules:**
- Tooltip appears on hover AND focus
- Tooltip is dismissible (Escape key)
- Tooltip is hoverable (user can move pointer to tooltip content)
- Tooltip persists while trigger is hovered/focused
- Tooltip has no interactive content — use popover/dialog for interactive content
- Use `aria-describedby` (supplementary info), not `aria-labelledby` (replacement name)

**CSS:**

```css
.tooltip {
  display: none;
  position: absolute;
}

button:hover + .tooltip,
button:focus-visible + .tooltip,
.tooltip:hover {
  display: block;
}
```
