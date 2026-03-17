## Animating Elements (`remix/component`)

Use this reference when building animations in app code.

Use [./create-mixins.md](./create-mixins.md) as a follow-up when the animation work turns into
authoring reusable animation mixins instead of applying built-in mixins in app code.

## Quick Start

```tsx
import { animateEntrance, animateExit, animateLayout, spring } from 'remix/component'

let el = (
  <div
    key="card"
    mix={[
      animateEntrance({ opacity: 0, transform: 'scale(0.95)', ...spring('snappy') }),
      animateExit({ opacity: 0, transform: 'scale(0.98)', duration: 120, easing: 'ease-in' }),
      animateLayout({ duration: 220, easing: 'ease-out' }),
    ]}
  />
)
```

## Core Patterns

### Enter-only element

```tsx
<div
  mix={[
    animateEntrance({
      opacity: 0,
      transform: 'translateY(8px)',
      duration: 180,
      easing: 'ease-out',
    }),
  ]}
/>
```

### Toggle visibility with enter + exit

```tsx
{
  isVisible && (
    <div
      key="panel"
      mix={[
        animateEntrance({ opacity: 0, transform: 'scale(0.98)', duration: 180 }),
        animateExit({ opacity: 0, transform: 'scale(0.98)', duration: 120, easing: 'ease-in' }),
      ]}
    />
  )
}
```

### Reordering/list layout animation

```tsx
{
  items.map((item) => (
    <li
      key={item.id}
      mix={[
        animateLayout({
          ...spring({ duration: 500, bounce: 0.2 }),
        }),
      ]}
    />
  ))
}
```

### Shared-layout swap

```tsx
import { animateEntrance, animateExit, css } from 'remix/component'

<div
  mix={[
    css({
      display: 'grid',
      '& > *': { gridArea: '1 / 1' },
    }),
  ]}
>
  {state ? (
    <div key="a" mix={[animateEntrance({ opacity: 0 }), animateExit({ opacity: 0 })]} />
  ) : (
    <div key="b" mix={[animateEntrance({ opacity: 0 }), animateExit({ opacity: 0 })]} />
  )}
</div>
```

## Practical Guidance

- Always key conditional or switching elements you expect to transition.
- Use `animateLayout` on the element whose position or size changes.
- Prefer one clear transition intent per mixin:
  - entrance starts from a defined initial style
  - exit ends at a defined final style
- For spring-style timing, spread `spring(...)` into the mixin config.
- Default to `...spring()` for duration and easing in most cases.
- Keep extra DOM work in `handle.queueTask(...)` or `ref(...)`, not in render math.

## Checklist

- [ ] Animated elements have stable keys where needed
- [ ] `animateLayout` is only on moving or resizing nodes
- [ ] No unnecessary custom state machines when simple mixins suffice
