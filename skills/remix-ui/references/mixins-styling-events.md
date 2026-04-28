## Host Elements

For host elements, compose behavior with `mix`, not legacy host props.

Common mixins exported from `remix/ui`:

- `on(...)`
- `ref(...)`
- `css(...)`
- `link(...)`
- `animateEntrance(...)`
- `animateExit(...)`
- `animateLayout(...)`

Prefer these built-ins before custom normalization code:

- `link(href, options)` when a non-anchor element should behave like a Remix navigation link

## Events

Use `mix={[on(type, handler)]}` for DOM listeners.

```tsx
<form
  mix={[
    on('submit', async (event, signal) => {
      event.preventDefault()
      let formData = new FormData(event.currentTarget)
      await submit(formData, { signal })
    }),
  ]}
/>
```

Rules:

- Event handlers may receive `signal`.
- Pass `signal` to async work when possible.
- Check `signal.aborted` after async work if the API cannot cancel itself.

## Refs

Use `ref(...)` for DOM node access:

```tsx
<input mix={[ref((node) => node.focus())]} />
```

## Styling

Prefer the `css(...)` mixin for static stylesheet-like rules and `style` for dynamic values.

```tsx
<button
  mix={[
    css({
      color: 'white',
      backgroundColor: 'blue',
      '&:hover': { backgroundColor: 'darkblue' },
      '@media (max-width: 768px)': { width: '100%' },
    }),
  ]}
  style={{ opacity: disabled ? 0.5 : 1 }}
/>
```

Use `css(...)` for selectors, nested rules, and media queries. Use `style` for dynamic numeric or
string values that change often.

## Animation

Use animation mixins instead of the removed `animate` prop:

```tsx
<div
  key={item.id}
  mix={[
    animateEntrance({ opacity: 0, transform: 'scale(0.98)' }),
    animateExit({ opacity: 0 }),
    animateLayout(),
  ]}
/>
```

For deeper guidance, also read:

- [./animate-elements.md](./animate-elements.md)
- [./create-mixins.md](./create-mixins.md)
