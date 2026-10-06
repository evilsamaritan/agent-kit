---
name: html
description: "Write semantic HTML. Use for document structure, landmarks, forms, labels, native controls, media, metadata, and accessible markup."
user-invocable: true
---

# HTML5

Semantic markup carries meaning to assistive technology, crawlers, and reader modes. Every element is a contract — pick the one that matches intent, not the one that "looks right".

---

## Hard Rules

- Every `<img>` has `alt` — empty (`alt=""`) for decorative, descriptive for content
- Every form `<input>` has a `<label>` — explicit `for`/`id` or implicit wrapping
- Exactly one `<main>` per document
- `<html lang="...">` is non-negotiable — required for screen readers, hyphenation, bidi
- `<button>` for actions, `<a href>` for navigation — never interchange
- Never attach click handlers to `<div>` / `<span>` for button behaviour
- Headings go in order (h1 → h2 → h3) — never skip levels to hit a style

---

## Semantic Decision Tree

| Need | Element | NOT |
|------|---------|-----|
| Independent, self-contained content (blog post, comment, card) | `<article>` | `<div>` |
| Thematic grouping with a heading within a page | `<section>` (with heading) | `<div>` |
| Sidebar, tangential content, callouts | `<aside>` | `<div class="sidebar">` |
| Site-wide or section navigation | `<nav>` | `<div class="nav">` |
| Page/section banner | `<header>` | `<div class="header">` |
| Page/section footer | `<footer>` | `<div class="footer">` |
| Primary content (one per page) | `<main>` | `<div id="main">` |
| Search/filter form container | `<search>` | `<div role="search">` |
| Disclosure widget (expand/collapse) | `<details>` + `<summary>` | custom div toggle |
| Modal dialog | `<dialog>` + `showModal()` | `<div role="dialog">` |
| No semantic meaning | `<div>` / `<span>` | — |

Landmark roles are implicit: `<nav>` = `role="navigation"`, `<main>` = `role="main"`, `<aside>` = `role="complementary"`, `<search>` = `role="search"`, `<header>` in body = `role="banner"`, `<footer>` in body = `role="contentinfo"`. Never add redundant ARIA roles to semantic elements.

`<search>` is the landmark container for search/filter forms; use it instead of `<div role="search">`.

---

## Document Outline

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Page title — Site</title>
  </head>
  <body>
    <a href="#main" class="skip-link">Skip to content</a>
    <header><!-- masthead, primary nav --></header>
    <nav aria-label="Primary"><!-- global nav --></nav>
    <main id="main">
      <h1>Page title</h1>
      <!-- content -->
    </main>
    <footer><!-- legal, secondary nav --></footer>
  </body>
</html>
```

- Skip link must be the first focusable element
- Heading order follows visual hierarchy, not typographic preference
- Multiple `<nav>` or `<aside>` elements are allowed — distinguish with `aria-label`

---

## Forms

```html
<form>
  <fieldset>
    <legend>Sign in</legend>

    <label for="email">Email</label>
    <input id="email" name="email" type="email"
           autocomplete="email" required>

    <label for="pw">Password</label>
    <input id="pw" name="password" type="password"
           autocomplete="current-password" required minlength="8">

    <button type="submit">Sign in</button>
  </fieldset>
</form>
```

- **Types carry behaviour.** `type="email"`, `type="tel"`, `type="url"`, `type="number"`, `type="date"`, `type="search"` — each changes the on-screen keyboard, validation, and parsing.
- **`autocomplete` is not optional.** Password managers, OS autofill, and 2FA flows rely on it: `email`, `current-password`, `new-password`, `one-time-code`, `street-address`, `cc-number`. Use `autocomplete="off"` only when truly unique (and accept that browsers may override).
- **Group related fields** in `<fieldset>` with `<legend>` — AT announces the group when any field gets focus.
- **Native validation first.** `required`, `pattern`, `minlength`, `maxlength`, `min`, `max`, `step`. Custom JS validation layers on top; never replaces.
- **Submission is a `<button type="submit">` inside a `<form>`** — this gives Enter-to-submit and form data serialization for free.

---

## Images & Media

```html
<!-- Content image -->
<img src="photo.jpg" alt="Two climbers on a granite face at sunset"
     width="1200" height="800" loading="lazy">

<!-- Decorative image (conveys nothing new) -->
<img src="divider.svg" alt="">

<!-- Resolution switching: the browser picks from srcset using sizes -->
<img src="photo-800.jpg"
     srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1600.jpg 1600w"
     sizes="(min-width: 60rem) 50vw, 100vw"
     alt="..." width="800" height="533">

<!-- Art-directed responsive image: different crops per breakpoint -->
<picture>
  <source media="(min-width: 900px)" srcset="wide.jpg">
  <source media="(min-width: 500px)" srcset="medium.jpg">
  <img src="narrow.jpg" alt="..." width="800" height="600">
</picture>

<!-- Video with captions -->
<video controls preload="metadata" poster="poster.jpg">
  <source src="clip.mp4" type="video/mp4">
  <track kind="captions" src="clip.en.vtt" srclang="en" label="English" default>
</video>
```

- Always set `width` and `height` to reserve layout space (prevents CLS)
- `loading="lazy"` for below-the-fold images; avoid on LCP hero images
- `poster` on `<video>` for fast perceived load
- Captions via `<track kind="captions">` — not cosmetic, legally required in many jurisdictions

---

## Native Interactive Elements

```html
<!-- Disclosure, zero JS -->
<details>
  <summary>Show advanced options</summary>
  <p>...</p>
</details>

<!-- Modal dialog -->
<dialog id="confirm">
  <form method="dialog">
    <p>Delete this item?</p>
    <button value="cancel">Cancel</button>
    <button value="delete">Delete</button>
  </form>
</dialog>
<script>
  document.querySelector("#open").addEventListener("click", () =>
    document.querySelector("#confirm").showModal()
  );
</script>

<!-- Popover API for menus, tooltips, toasts -->
<button popovertarget="menu">Menu</button>
<div id="menu" popover>
  <button>Profile</button>
  <button>Settings</button>
</div>
```

- `<dialog>` with `showModal()` — proper focus trap, `::backdrop`, Escape-to-close
- Use the Popover API for layered UI instead of z-index hacks — see `web` skill
- `<details>`/`<summary>` beats custom JS accordions when the only requirement is show/hide

---

## Tables

- Tables are for tabular data, never for layout
- `<caption>` describes the table
- `<thead>` / `<tbody>` / `<tfoot>` structure
- `<th scope="col">` or `<th scope="row">` for header cells — critical for screen readers
- `<td headers="id1 id2">` for complex multi-header tables

---

## Head essentials

Correct markup needs `<meta charset="utf-8">` first in `<head>`, the viewport meta, `<html lang>`, and a unique descriptive `<title>` (all shown in the outline above). Theme color and the web app manifest belong here too.

```html
<meta name="theme-color" content="#0d1117" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<link rel="manifest" href="/manifest.webmanifest">
```

Descriptions, canonical URLs, Open Graph, structured data, robots → `seo`.

---

## Anti-Patterns

Beyond the Hard Rules:

1. **Div soup.** A `<div>` that could be `<section>`, `<article>`, `<nav>`, or `<aside>` throws away meaning for assistive technology and reader modes.
2. **Headings used for styling.** `<h3>` because that is the size wanted breaks the outline; style with CSS.
3. **Wrong alt text.** `alt="image"`, descriptive alt on decorative images, or repeating the visible caption.
4. **Generic link text.** "Click here" and "read more" give screen-reader users, who skim link lists, no signal.
5. **`<table>` for layout.** Breaks reading order and responsive behavior.
6. **Nested `<button>` or `<a>`.** Invalid HTML with unpredictable interaction.
7. **Custom controls without roles, states, and keyboard handling.** Prefer a native element; otherwise → `accessibility`.

---

## Related Knowledge

- **css** — layout, visual treatment, animations, modern CSS features
- **accessibility** — WCAG compliance, ARIA patterns, focus management, keyboard navigation
- **i18n** — `lang`, `dir`, bidi markup, logical text direction
- **seo** — structured data, Open Graph, canonical URLs, sitemaps
- **web** — browser APIs invoked from HTML (Popover, dialog, Navigation API)
