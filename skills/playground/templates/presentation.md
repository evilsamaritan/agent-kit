# Template: Presentation

Use when the user asks for slides, a talk, a walkthrough for a meeting, or a guided story. A presentation is a sequence of scenes; it still needs to read without a speaker.

## Composition

Start from `assets/visualization-page.html`; slides are task-specific blocks (`deck-…` classes) built on the shared tokens and typography.

```text
scene: one claim as the title · one visual or a short list · speaker note (hidden, toggleable)
controls: previous / next, scene counter, overview grid, theme control
fallback: all scenes stacked in document order for print, phone, and no-JS
```

Keep one claim per scene. A scene with three diagrams is three scenes.

## Interaction

- Arrow keys, Page Up/Down, and Space move between scenes; Home/End jump; Escape opens the overview.
- The URL hash records the current scene so a link opens it.
- Reveal steps inside a scene only when order matters to the argument; reduced motion shows the final state.
- Printing yields one scene per page with speaker notes optional.

## Scaling

Scenes fit the viewport with real reflow (stack visuals under text on narrow screens), never by scaling a fixed 16:9 canvas until the labels are unreadable.

## Pitfalls

- Bullet walls copied from a document; a presentation states claims, the document holds the detail.
- Auto-advancing scenes.
- Scenes that only work with the speaker present.
