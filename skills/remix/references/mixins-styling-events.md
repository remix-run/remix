# Mixins, Styling, and Events

## What This Covers

How to attach behavior, styles, and DOM-aware setup to host elements with `mix={[...]}`. Read this
when the task involves:

- DOM event handling with `on(...)`
- Static styling with `css(...)` and dynamic styling with `style`
- Imperative DOM access via `ref(...)`
- Navigation behavior on non-anchor elements with `link(...)`
- Press, key, or attribute helpers (`pressEvents`, `keysEvents`, `attrs`)
- Element-level animation mixins (`animateEntrance`, `animateExit`, `animateLayout`)

For richer animation work (springs, tweens, layout transitions), see `animate-elements.md`. For
authoring custom mixins, see `create-mixins.md`. For component lifecycle and updates, see
`component-model.md`.

Compose behavior on host elements with `mix`. All mixins are imported from `remix/component`.

## `on(type, handler, capture?)`

Attaches a typed DOM event handler. The handler receives the event and an `AbortSignal` that aborts
when the handler is re-entered or the component is removed — this prevents race conditions:

```tsx
<input
  mix={[
    on('input', async (event, signal) => {
      let query = event.currentTarget.value
      loading = true
      handle.update()

      let response = await fetch(`/search?q=${query}`, { signal })
      let data = await response.json()
      if (signal.aborted) return

      results = data.results
      loading = false
      handle.update()
    }),
  ]}
/>
```

Multiple events on the same element:

```tsx
<form
  mix={[
    on('submit', (event) => {
      event.preventDefault()
      let formData = new FormData(event.currentTarget)
    }),
  ]}
>
```

## `css(styles)`

Applies generated class names for CSS object styles. Produces static CSS rules inserted into the
document. Supports pseudo-selectors, pseudo-elements, attribute selectors, descendant selectors, and
media queries using `&` to reference the current element:

```tsx
<button
  mix={[
    css({
      color: 'white',
      backgroundColor: 'blue',
      padding: '12px 24px',
      borderRadius: '4px',
      border: 'none',
      cursor: 'pointer',
      '&:hover': { backgroundColor: 'darkblue' },
      '&:active': { transform: 'scale(0.98)' },
      '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
      '& .title': { fontSize: '20px', fontWeight: 'bold' },
      '@media (max-width: 768px)': { width: '100%' },
    }),
  ]}
/>
```

### `css(...)` vs `style` prop

Use `css(...)` for static styles, selectors, and media queries. Use `style` for dynamic values that
change often. Prefer CSS nested selectors for parent-state-affects-children over managing hover/focus
state in JavaScript:

```tsx
<div
  mix={[
    css({
      backgroundColor: 'blue',         // static
      '&:hover': { '& .title': { color: 'blue' } },  // parent hover → child
    }),
  ]}
  style={{ width: `${progress}%` }}   // dynamic
/>
```

## `ref(callback)`

Calls a callback when an element is inserted. The callback receives the DOM node and an
`AbortSignal` that aborts when the element is removed:

```tsx
<input mix={[ref((node) => node.focus())]} />

<div mix={[ref((node, signal) => {
  let observer = new ResizeObserver((entries) => {
    dimensions.width = Math.round(entries[0].contentRect.width)
    handle.update()
  })
  observer.observe(node)
  signal.addEventListener('abort', () => observer.disconnect())
})]} />
```

The `ref` callback runs once when the element is first rendered, not on every update.

## `link(href, options?)`

Adds client-side navigation behavior to any element. Makes non-anchor elements behave like Remix
navigation links:

```tsx
<article mix={[link('/courses/intro')]}>
  <h3>Introduction</h3>
</article>
```

Options match `NavigationOptions`: `src`, `target`, `history` (`'push' | 'replace'`),
`resetScroll`.

## `pressEvents()`

Normalizes pointer and keyboard input into press lifecycle events. Fires on mouse, touch, and
keyboard (Enter/Space). Prefer over `click` for interactive elements:

```tsx
<button mix={[pressEvents(), on('press', () => doAction())]}>Action</button>
```

Event type constants for `on(...)`:

- `pressEvents.press` — full press (down + up)
- `pressEvents.down` — press start
- `pressEvents.up` — press end
- `pressEvents.long` — long press
- `pressEvents.cancel` — press cancelled

## `keysEvents()`

Normalizes common keyboard keys into custom key-specific DOM events:

```tsx
<div tabIndex={0} mix={[keysEvents(), on(keysEvents.escape, () => close())]}>
```

Event type constants: `keysEvents.escape`, `.enter`, `.space`, `.backspace`, `.del`, `.arrowLeft`,
`.arrowRight`, `.arrowUp`, `.arrowDown`, `.home`, `.end`, `.pageUp`, `.pageDown`.

## `attrs()`

Sets HTML attributes through the mixin system.

## Animation Mixins

### `animateEntrance(config)`

Animates an element when it is inserted into the DOM. Config specifies the **starting** style:

```tsx
<div mix={[animateEntrance({ opacity: 0, transform: 'translateY(8px)', duration: 180 })]} />
```

### `animateExit(config)`

Animates an element when it is removed. Config specifies the **ending** style. The element is kept
in the DOM until the animation completes:

```tsx
{isVisible && (
  <div
    key="panel"
    mix={[
      animateEntrance({ opacity: 0, transform: 'scale(0.98)', ...spring('smooth') }),
      animateExit({ opacity: 0, duration: 120, easing: 'ease-in' }),
    ]}
  />
)}
```

### `animateLayout(config?)`

Animates layout changes (position/size) using FLIP-style transforms:

```tsx
{items.map((item) => (
  <li key={item.id} mix={[animateLayout({ duration: 220, easing: 'ease-out' })]} />
))}
```

Options: `duration` (default 200ms), `easing` (default spring snappy), `size` (boolean, default
true — include scale projection for size changes).

Always key elements you expect to animate. Use `...spring(preset)` to spread `duration` and
`easing` into any animation config.
