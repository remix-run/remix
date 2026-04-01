## Static and Dynamic Styles

Use `css(...)` as the default for static styles through `mix`.

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

Use `css(...)` for selectors, pseudo-states, nested rules, and media queries. Use `style` for
dynamic numeric or string values that change at render time.

## State Selectors

Prefer CSS selectors when the state is already visible in the DOM or can be expressed by structure:

- `&:hover`, `&:focus`, `&:focus-visible`, and `&:disabled` for host-element states
- `&[aria-current="page"]` and similar attribute selectors for semantic state
- descendant selectors when parent state changes child presentation

Only introduce JavaScript state when the UI behavior itself needs it, not just to flip classes or
inline styles.

## Style Ownership

Keep styles with the narrowest owner first:

- route-owned styles stay next to route-owned UI
- shared cross-route styles belong with shared UI in `app/ui/`

If a styling change also alters interaction behavior, hydration, or event handling, load
`../../remix-ui/SKILL.md` too.

## Verify Visual States

After styling work, check:

- hover and focus states
- active, disabled, hidden, and empty states
- at least one narrow and one wide viewport
