# Tween API

A generator-based tween function for animating values over time with cubic bezier easing.

## Basic Usage

```tsx
import { tween, easings } from 'remix/component'

let animation = tween({
  from: 0,
  to: 100,
  duration: 1000,
  curve: easings.easeInOut,
})

// Initialize generator
animation.next()

function animate(timestamp: number) {
  let { value, done } = animation.next(timestamp)
  element.style.transform = `translateX(${value}px)`
  if (!done) requestAnimationFrame(animate)
}

requestAnimationFrame(animate)
```

## How It Works

The `tween` function returns a generator that:

1. Yields the current interpolated value on each iteration
2. Receives the current timestamp via `next(timestamp)`
3. Returns `done: true` when the duration has elapsed

The generator uses cubic bezier curves to map linear time progress to eased value progress, matching CSS `cubic-bezier()` timing functions.

## Easing Presets

Built-in easing curves matching CSS timing functions:

```tsx
import { easings } from 'remix/component'

easings.linear // { x1: 0, y1: 0, x2: 1, y2: 1 }
easings.ease // { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }
easings.easeIn // { x1: 0.42, y1: 0, x2: 1, y2: 1 }
easings.easeOut // { x1: 0, y1: 0, x2: 0.58, y2: 1 }
easings.easeInOut // { x1: 0.42, y1: 0, x2: 0.58, y2: 1 }
```

## Custom Curves

Define custom bezier curves with control points:

```tsx
let customCurve = {
  x1: 0.68,
  y1: -0.55,
  x2: 0.265,
  y2: 1.55,
}

let animation = tween({
  from: 0,
  to: 100,
  duration: 500,
  curve: customCurve,
})
```

The control points match CSS `cubic-bezier(x1, y1, x2, y2)` syntax.

## In Components

Use tween with `handle.signal` for automatic cleanup:

```tsx
function AnimatedValue(handle: Handle) {
  let value = 0

  function animateTo(target: number) {
    let animation = tween({
      from: value,
      to: target,
      duration: 300,
      curve: easings.easeOut,
    })

    animation.next() // Initialize

    function tick(timestamp: number) {
      if (handle.signal.aborted) return

      let result = animation.next(timestamp)
      value = result.value
      handle.update()

      if (!result.done) {
        requestAnimationFrame(tick)
      }
    }

    requestAnimationFrame(tick)
  }

  return () => (
    <div>
      <div style={{ transform: `translateX(${value}px)` }}>Moving</div>
      <button
        on={{
          press() {
            animateTo(200)
          },
        }}
      >
        Animate
      </button>
    </div>
  )
}
```

## Multiple Properties

Animate multiple values with separate tweens:

```tsx
let xAnimation = tween({ from: 0, to: 100, duration: 500, curve: easings.easeOut })
let yAnimation = tween({ from: 0, to: 50, duration: 500, curve: easings.easeOut })
let scaleAnimation = tween({ from: 1, to: 1.5, duration: 500, curve: easings.easeOut })

xAnimation.next()
yAnimation.next()
scaleAnimation.next()

function animate(timestamp: number) {
  let x = xAnimation.next(timestamp)
  let y = yAnimation.next(timestamp)
  let scale = scaleAnimation.next(timestamp)

  element.style.transform = `translate(${x.value}px, ${y.value}px) scale(${scale.value})`

  if (!x.done || !y.done || !scale.done) {
    requestAnimationFrame(animate)
  }
}

requestAnimationFrame(animate)
```

## API Reference

### `tween(options)`

Creates a generator that interpolates between values over time.

```ts
interface TweenOptions {
  from: number // Starting value
  to: number // Ending value
  duration: number // Duration in milliseconds
  curve: BezierCurve // Easing curve
}

interface BezierCurve {
  x1: number // First control point X (0-1)
  y1: number // First control point Y
  x2: number // Second control point X (0-1)
  y2: number // Second control point Y
}
```

**Returns:** `Generator<number, number, number>` - Yields current value, returns final value when done.

### `easings`

Object containing preset bezier curves:

| Preset      | Description               |
| ----------- | ------------------------- |
| `linear`    | No easing, constant speed |
| `ease`      | Default CSS ease          |
| `easeIn`    | Slow start, fast end      |
| `easeOut`   | Fast start, slow end      |
| `easeInOut` | Slow start and end        |

## When to Use

Use `tween` for:

- Imperative animations driven by `requestAnimationFrame`
- Canvas/WebGL animations
- Animating non-CSS properties
- Complex sequenced animations

For most UI animations, prefer the declarative [`animate` prop](./animate.md) or CSS transitions with [`spring`](./spring.md).

## See Also

- [Animate API](./animate.md) - Declarative enter/exit/layout animations
- [Spring API](./spring.md) - Physics-based easing for CSS
