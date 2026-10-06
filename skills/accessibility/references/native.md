# Native Platform Accessibility

What differs from the web on iOS and Android. WCAG success criteria still define the goal (names, roles, states, contrast, target size, motion, timing); the mechanism changes from DOM plus ARIA to a platform accessibility tree. Mobile lifecycle, permissions and UX conventions live in `mobile`.

## Contents

- [Model differences](#model-differences)
- [iOS](#ios)
- [Android](#android)
- [Cross-platform frameworks](#cross-platform-frameworks)
- [Targets, text scaling, motion](#targets-text-scaling-motion)
- [Testing](#testing)

---

## Model differences

| Web | Native |
|-----|--------|
| Native HTML element supplies role | Standard platform control supplies role and traits; custom views start with none |
| Accessible name from text, `<label>`, `aria-label` | Explicit label property on the view (a label on every icon-only control) |
| ARIA states (`aria-expanded`, `aria-selected`) | Trait or state property (selected, expanded, checked, state description) |
| Live regions | Explicit announcement or live-region API |
| DOM order is reading order | View hierarchy and explicit traversal order |
| Zoom and reflow | System font scale, display size, bold text settings |

Rule order matches the web: use the standard control first, add semantics to custom views second, never describe what the platform already announces (do not put "button" in a label).

## iOS

- **Label, value, traits.** `accessibilityLabel` is the name, `accessibilityValue` the current value (slider, stepper), `accessibilityTraits` the role and state (button, header, selected, adjustable). `accessibilityHint` is optional and read after a pause; use it only when the result of the action is not obvious from the label.
- **SwiftUI** modifiers: `.accessibilityLabel`, `.accessibilityValue`, `.accessibilityAddTraits`, `.accessibilityElement(children:)` to combine or ignore children, `.accessibilityHidden` for decoration.
- **Grouping.** Combine a row (icon, title, subtitle) into one element so VoiceOver does not make three stops. Mark section titles with the header trait for rotor navigation.
- **Custom actions** (`accessibilityCustomActions`) replace swipe-only and long-press-only gestures, like the web's non-dragging alternative.
- **Modal content.** Mark a custom overlay as modal (`accessibilityViewIsModal`) so focus stays inside it.
- **Announcements.** Post an announcement for transient status; post a screen-changed or layout-changed notification after a navigation or large content change and name the element that should receive focus.
- **Dynamic Type.** Use text styles (`UIFont.preferredFont(forTextStyle:)`, SwiftUI `.font(.body)`), scale non-text metrics with `@ScaledMetric`, and let layouts reflow at the largest accessibility sizes instead of truncating.
- **Settings to honor:** Reduce Motion, Reduce Transparency, Increase Contrast, Bold Text, Differentiate Without Color, Prefer Cross-Fade Transitions.

## Android

- **Names and roles.** Standard views take `contentDescription` for non-text content; set it to null (or mark not important for accessibility) for decorative views. Compose uses `Modifier.semantics { contentDescription = ...; role = Role.Button; stateDescription = ... }`; `Modifier.clearAndSetSemantics` replaces the subtree's semantics.
- **Grouping.** `mergeDescendants = true` makes a row one TalkBack focus stop. Headings: `heading()` in Compose, `accessibilityHeading` on views.
- **Live updates.** `liveRegion` (polite or assertive) on the changing view, or an announcement through the accessibility manager.
- **Custom actions.** Add accessibility actions for gesture-only operations such as swipe-to-delete.
- **Focus order.** Follows layout order; override with traversal ordering only when the visual layout cannot match the reading order.
- **Text.** Size text in `sp`, not `dp`, and test at the largest font scale and display size.
- **Settings to honor:** animation scale or remove-animations setting, high-contrast text, color correction, switch access and voice access.

## Cross-platform frameworks

React Native, Flutter and similar frameworks map their own props onto the platform tree. They do not add accessibility by themselves.

- React Native: `accessible`, `accessibilityLabel`, `accessibilityRole`, `accessibilityState`, `accessibilityActions`.
- Flutter: the `Semantics` widget (label, value, button, header, liveRegion), `ExcludeSemantics`, `MergeSemantics`; check text scaling through `MediaQuery`.
- Canvas or game-engine UIs expose nothing to the accessibility tree unless the team builds it; plan an explicit semantic layer or an alternative accessible UI.
- Verify behavior on a real device with the platform screen reader, because the mapping differs per platform.

## Targets, text scaling, motion

| Concern | Web (WCAG 2.2) | Platform guidance |
|---------|----------------|-------------------|
| Minimum target | 24 by 24 CSS px (AA) | iOS 44 by 44 pt, Android 48 by 48 dp |
| Text scaling | Reflow at 200% resize and 320 px | System font scale: no clipping or overlap at the largest setting |
| Motion | `prefers-reduced-motion` | Reduce Motion (iOS), animation settings (Android) |

Meet the larger platform guideline for touch; it also satisfies the WCAG minimum.

## Testing

- Turn on VoiceOver (iOS) and TalkBack (Android) and complete each core flow using only the screen reader: every control has a name, state is announced, focus order matches intent, no focus is lost after a dialog closes.
- Run Accessibility Inspector (iOS) and Accessibility Scanner or the framework's automated checks (Android) for missing labels, small targets and contrast. Automated checks find a minority of issues.
- Test at the largest font scale, with bold text, with reduced motion, and with an external keyboard or switch control for the flows that matter.
- Native conformance claims map WCAG through the WCAG2ICT guidance and regional standards; see [enforcement-timeline.md](enforcement-timeline.md) for the legal context.
