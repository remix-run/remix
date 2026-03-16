# Design System Preferences

## Stable

- Prefer clean, utilitarian web application styling over marketing or brochure aesthetics.
- Default controls should feel compact and close to native density.
- Buttons should feel polished and cohesive without looking like a separate glossy component family.
- Colored button variants should use the same structural treatment as neutral buttons.
  - shared base object
  - tone-specific color layer
  - borders, highlights, and shadows derived from the tone rather than bespoke variant styling
- Button text should feel soft rather than harsh.
  - softer white foregrounds on filled actions
  - avoid heavy text-shadow or crunchy contrast
- Typography should feel quiet, readable, and product-oriented.
  - not loud, brandy, or over-designed
- Hover affordances should usually feel immediate.
  - subtle hover color shifts are good
  - avoid animated hover transitions when they make controls feel laggy
- Selection and highlight states should usually snap immediately.
  - avoid animating list row highlights, menu selection states, and similar ephemeral feedback
  - if a state is meant to orient the user quickly, prefer crisp change over polish
- Eyebrows and metadata should be subdued and not compete with headings.
- Surface typography should feel tighter and calmer than page typography.
- Prefer broad semantic mixins that first-party components and app code can share.
  - avoid demo-only abstractions becoming the de facto design-system taxonomy
- `ui` should stay centered on composable base objects plus tone/state mixins.
- Mixins should be allowed to carry safe default host attributes so call sites stay minimal.
  - prefer defaults supplied by mixins over repeating the same element attributes everywhere
  - explicit JSX props should still win
  - do not add special merging behavior for `className` or `style`; only fill them when absent
- When using `mix`, prefer passing a single value directly instead of wrapping it in a one-item array.
- The demo should clarify the whole design system, not imply that `RMX_01` itself is the whole story.
- A dedicated proof sheet is valuable for evaluating a theme’s overall character quickly.
- The docs shell itself should stay demo-specific even if some sidebar/navigation ingredients become reusable primitives.
- While `packages/ui` is still incubating, do not create change files for it yet.
  - treat it as pre-publish internal iteration until we explicitly decide to publish it

## Learned

- Vertical rhythm matters as much as token choice.
  - avoid scrunched content stacks
  - prefer intentional spacing boundaries between intro text and following lists or utility blocks
- Showcase/demo panels should read as reference artifacts when appropriate.
  - not every card should read like real content
  - system showcase panels should prioritize clarity of demonstration

## Avoid

- Glossy variant-specific button treatments that make colored buttons feel like a different family.
- Harsh, high-contrast, crunchy text treatment.
- Loud metadata that competes with primary content.
- Surface content that is technically styled correctly but feels cramped because spacing rhythm is off.
