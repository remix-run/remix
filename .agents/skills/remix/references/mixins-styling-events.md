# Mixins, Styling, and Events

Read for host-element behavior, styles, DOM access, or accessible interaction. Use the installed `src/ui/README.md`, the relevant `src/ui/<primitive>/README.md`, and `src/ui/animation/README.md` for first-party controls and animation APIs. See [component model](component-model.md) for updates and cleanup.

## Compose Host Behavior

Core mixins (`on`, `css`, `ref`, `link`, `attrs`) are imported from `remix/ui`. Pass one descriptor as `mix={on(...)}` or compose several with `mix={[css(...), on(...)]}`. Prefer existing primitives for complex controls such as menus, comboboxes, tabs, and popovers before inventing a reusable interaction.

Use native elements and event semantics:

```tsx
import { css, on } from 'remix/ui'
import type { Handle } from 'remix/ui'

export function ToggleDetails(handle: Handle) {
  let expanded = false

  return () => (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={handle.id}
        mix={[
          css({ padding: '0.5rem 1rem', '&:focus-visible': { outline: '2px solid' } }),
          on('click', () => {
            expanded = !expanded
            handle.update()
          }),
        ]}
      >
        Details
      </button>
      <div id={handle.id} hidden={!expanded}>
        Additional information
      </div>
    </div>
  )
}
```

`on(type, handler, capture?)` receives the typed event and a cancellation signal. The signal aborts when the handler is re-entered or its host lifecycle ends; pass it to async work and ignore canceled results. Read control values from `event.currentTarget`. A native button's `click` already handles keyboard activation; pointer-only handlers do not.

Use actual anchors for navigation. `link(...)` can add navigation behavior, but making a generic element clickable does not by itself establish all the semantics, focus behavior, and browser affordances of an anchor.

## Style Without Unnecessary State

- Use `css(...)` for static rules, nested selectors, media queries, and keyframes. Use the `style` prop for frequently changing values such as progress or measured dimensions.
- Keep short one-off rules inline. Extract a module-scoped descriptor for a reused visual recipe or a large selector set; export it only when other modules need it.
- Use CSS hover/focus/disabled selectors rather than JavaScript state that duplicates browser state.
- Generated rules live in the `rmx` cascade layer. Unlayered styles outrank layered styles; define global layer ordering when combining resets, app styles, and Remix styles. The UI README explains this behavior.
- SSR collects generated CSS. Do not add a second style-injection system just to make server-rendered styles appear.

## Use Refs for Element Lifecycles

`ref(callback)` supplies the inserted element and a signal for its removal. It is not an every-render effect. Use cleanup for observers and imperative libraries:

```tsx
import { ref } from 'remix/ui'

const observeSize = ref((node, signal) => {
  let observer = new ResizeObserver(() => {
    // Measure the node or notify the owning component here.
  })
  observer.observe(node)
  signal.addEventListener('abort', () => observer.disconnect(), { once: true })
})

// On the observed element: <div mix={observeSize} />
```

Use `handle.queueTask(...)` for DOM work that depends on the next committed update. Use component-lifetime cleanup for global listeners; see the component-model recipe rather than registering them during render.

## Accessibility and Motion

- Use buttons for actions, anchors for navigation, labels for controls, and explicit button types inside forms. Prefer native semantics over adding roles and keyboard handlers to generic elements.
- Connect errors to inputs with `aria-describedby` and `aria-invalid`. Announce meaningful async status/errors without making every changing element a live region.
- Preserve focus when updating frames or removing a focused element. Move focus intentionally to the relevant error, dialog, or replacement control; do not autofocus unrelated content on every update.
- Do not suppress native form validation or submission unless the replacement preserves their behavior. Keep document navigation available when enhancement is unsuitable.
- Respect `prefers-reduced-motion` and avoid communicating state solely through animation or color.

For entrance, exit, and layout motion, read the animation README rather than building imperative loops by default. Key elements whose identity matters during removal/reordering, animate only the changing region, and clean up imperative work. For a genuinely reusable new behavior, see [creating mixins](create-mixins.md).
