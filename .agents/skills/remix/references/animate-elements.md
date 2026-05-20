# Animating Elements

## What This Covers

How to animate insertion, removal, and layout changes of elements. Read this when the task
involves:

- Adding entrance, exit, or shared-layout transitions to UI
- Choosing between spring physics (`spring(...)`) and time-based easing (`tween`)
- Coordinating CSS transitions with the same easing as JS animations
- Imperative animation loops via `requestAnimationFrame`

Import animation APIs from `remix/ui/animation`. For the smaller set of animation helpers that
show up alongside other mixins, see `mixins-styling-events.md`.

## Animation Mixins

### `animateEntrance(config)`

Animates an element when inserted. Config specifies the **starting** style the element animates
**from**:

```tsx
<div
  mix={animateEntrance({
    opacity: 0,
    transform: 'translateY(8px)',
    ...spring('smooth'),
  })}
/>
```

### `animateExit(config)`

Animates an element when removed. Config specifies the **ending** style the element animates
**to**. The element stays in the DOM until the animation completes:

```tsx
{
  isVisible && (
    <div
      key="panel"
      mix={[
        animateEntrance({ opacity: 0, transform: 'scale(0.98)', ...spring('smooth') }),
        animateExit({ opacity: 0, duration: 120, easing: 'ease-in' }),
      ]}
    />
  )
}
```

### `animateLayout(config?)`

Animates layout changes (position/size) using FLIP-style transforms:

```tsx
{
  items.map((item) => (
    <li key={item.id} mix={animateLayout({ ...spring({ duration: 500, bounce: 0.2 }) })} />
  ))
}
```

Options: `duration` (default 200ms), `easing` (default spring snappy), `size` (default true —
include scale projection for size changes).

### Combining mixins

```tsx
<div
  key="card"
  mix={[
    animateEntrance({ opacity: 0, transform: 'scale(0.95)', ...spring('snappy') }),
    animateExit({ opacity: 0, transform: 'scale(0.98)', duration: 120, easing: 'ease-in' }),
    animateLayout({ duration: 220, easing: 'ease-out' }),
  ]}
/>
```

### Shared-layout swap

```tsx
<div mix={css({ display: 'grid', '& > *': { gridArea: '1 / 1' } })}>
  {stateA ? (
    <div key="a" mix={[animateEntrance({ opacity: 0 }), animateExit({ opacity: 0 })]} />
  ) : (
    <div key="b" mix={[animateEntrance({ opacity: 0 }), animateExit({ opacity: 0 })]} />
  )}
</div>
```

## Spring API

Physics-based spring animation. Returns a `SpringIterator` with `duration`, `easing`, and
`toString()` for CSS.

### Presets

| Preset   | Bounce | Duration | Character                   |
| -------- | ------ | -------- | --------------------------- |
| `smooth` | -0.3   | 400ms    | Overdamped, no overshoot    |
| `snappy` | 0      | 200ms    | Critically damped, quick    |
| `bouncy` | 0.3    | 400ms    | Underdamped, visible bounce |

```tsx
spring('bouncy')
spring('snappy')
spring('smooth')
spring('bouncy', { duration: 300 }) // override duration
```

### Custom spring

```tsx
spring({ duration: 500, bounce: 0.3 })
spring({ duration: 500, bounce: 0.3, velocity: 2 }) // continue momentum from gesture
```

### Spread into animation mixins

Spreading a spring gives both `duration` and `easing`:

```tsx
animateEntrance({ opacity: 0, ...spring('bouncy') })
```

### CSS transitions

The iterator stringifies to `"550ms linear(...)"`:

```tsx
css({ transition: `width ${spring('bouncy')}` })
```

Or use the `spring.transition()` helper for multiple properties:

```tsx
css({ transition: spring.transition('width', 'bouncy') })
css({ transition: spring.transition(['left', 'top'], 'snappy') })
```

### Web Animations API

```tsx
element.animate(keyframes, { ...spring('bouncy') })
```

### JS iteration

The iterator yields position values from 0 to 1, one per frame:

```tsx
for (let t of spring('bouncy')) {
  let x = from + (to - from) * t
  updateSomething(x)
  await nextFrame()
}
```

## Tween API

Generator-based tween for animating values over time with cubic bezier easing. Prefer animation
mixins or CSS transitions with `spring` for most UI work. Use `tween` for imperative
`requestAnimationFrame` loops, canvas/WebGL, or non-CSS properties.

```tsx
import { tween, easings } from 'remix/ui/animation'

let animation = tween({
  from: 0,
  to: 100,
  duration: 300,
  curve: easings.easeOut,
})

animation.next() // initialize
function tick(timestamp: number) {
  if (handle.signal.aborted) return
  let { value, done } = animation.next(timestamp)
  element.style.transform = `translateX(${value}px)`
  if (!done) requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
```

Built-in easings: `easings.linear`, `easings.ease`, `easings.easeIn`, `easings.easeOut`,
`easings.easeInOut`.

## Practical Guidance

- Always key conditional or switching elements you expect to animate.
- Use `animateLayout` only on the element whose position or size changes.
- Prefer one clear transition intent per mixin: entrance starts from a style, exit ends at a style.
- Default to `...spring()` for duration and easing in most cases.
- Keep DOM work in `handle.queueTask(...)` or `ref(...)`, not in render.
