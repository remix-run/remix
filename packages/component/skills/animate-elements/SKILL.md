---
name: animate-elements
description: Build UI animations in Remix using mixins (`mix`, `animateEntrance`, `animateExit`, `animateLayout`). Use when implementing enter/exit transitions, FLIP reordering, shared-layout swaps, or animation-heavy app interactions.
---

# Animating Elements (`remix/component`)

Use this skill when building animations.

## Quick Start

Import mixin helpers from `remix/component` and apply them via `mix`.

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

### 1) Enter-only element

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

### 2) Toggle visibility with enter + exit

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

### 3) Reordering/list layout animation

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

### 4) Shared-layout swap (same slot, different keyed child)

```tsx
<div css={{ display: 'grid', '& > *': { gridArea: '1 / 1' } }}>
  {state ? (
    <div key="a" mix={[animateEntrance({ opacity: 0 }), animateExit({ opacity: 0 })]} />
  ) : (
    <div key="b" mix={[animateEntrance({ opacity: 0 }), animateExit({ opacity: 0 })]} />
  )}
</div>
```

## Practical Guidance

- Always key conditional/switching elements you expect to transition.
- Use `animateLayout` on the element whose position/size changes.
- Prefer one clear transition intent per mixin:
  - entrance starts from a defined initial style
  - exit ends at a defined final style
- For spring-style timing, spread `spring(...)` into the mixin config.
- Default to `...spring()` for duration/easing in most cases.
- Keep effectful DOM work (WAAPI shake, measurements) in `handle.queueTask(...)` or `ref(...)`, not in pure render math.

## Animation Checklist

- [ ] Animated elements have stable keys where needed.
- [ ] `animateLayout` is only on moving/resizing nodes.
- [ ] No unnecessary custom state machines when simple mixins suffice.
