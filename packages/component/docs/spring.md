# Spring API

A physics-based spring animation function that returns an iterator with CSS easing.

## Basic Usage

```tsx
import { spring } from './spring.ts'

// Using a preset
spring('bouncy') // bouncy with overshoot
spring('snappy') // quick, no overshoot (default)
spring('smooth') // gentle, overdamped

// Custom spring
spring({ duration: 400, bounce: 0.3 })
```

## Return Value

`spring()` returns a `SpringIterator`:

```ts
interface SpringIterator extends IterableIterator<number> {
  duration: number // CSS duration in ms (e.g., 550)
  easing: string // CSS linear() function
  toString(): string // "550ms linear(...)"
}
```

The iterator can be:

- **Iterated** to get position values (0→1) for JS animations
- **Spread** into objects (for animate/WAAPI)
- **Stringified** via template literals or `String()` (for CSS transitions)

## CSS Transitions

### Template literal

```tsx
css={{
  transition: `width ${spring('bouncy')}`
}}
// → "width 550ms linear(...)"
```

### Multiple properties (same spring)

```tsx
css={{
  transition: `transform ${spring('bouncy')}, opacity ${spring('bouncy')}`
}}
```

### Using the helper

```tsx
css={{
  transition: spring.transition('width', 'bouncy')
}}
// → "width 550ms linear(...)"

css={{
  transition: spring.transition(['left', 'top'], 'snappy')
}}
// → "left 385ms linear(...), top 385ms linear(...)"
```

## Animate Prop

Spread the spring value to get both `duration` and `easing`:

```tsx
animate={{
  enter: {
    opacity: 0,
    transform: 'scale(0.9)',
    ...spring('bouncy')
  },
  exit: {
    opacity: 0,
    ...spring('snappy')
  }
}}
```

## Presets

| Preset   | Bounce | Duration | Character                   |
| -------- | ------ | -------- | --------------------------- |
| `smooth` | -0.3   | 400ms    | Overdamped, no overshoot    |
| `snappy` | 0      | 200ms    | Critically damped, quick    |
| `bouncy` | 0.3    | 300ms    | Underdamped, visible bounce |

### Override preset duration

```tsx
spring('bouncy', { duration: 300 }) // faster bouncy
spring('smooth', { duration: 800 }) // slower smooth
```

## Custom Springs

### Parameters

```tsx
spring({
  duration: 500, // perceived duration in milliseconds
  bounce: 0.3, // -1 to 1 (negative = overdamped, 0 = critical, positive = bouncy)
  velocity: 0, // initial velocity in units per second
})
```

### Bounce values

- `bounce < 0`: Overdamped (slower settling, no overshoot)
- `bounce = 0`: Critically damped (fastest settling without overshoot)
- `bounce > 0`: Underdamped (bouncy, overshoots target)

```tsx
spring({ bounce: -0.5 }) // very smooth, slow
spring({ bounce: 0 }) // snappy, no bounce
spring({ bounce: 0.3 }) // slight bounce
spring({ bounce: 0.7 }) // very bouncy
```

## Velocity

Use `velocity` to continue momentum from a gesture:

```tsx
// Positive = moving toward target (more overshoot)
// Negative = moving away from target (takes longer)

spring('bouncy', { velocity: 2 }) // fast start
spring('bouncy', { velocity: -1 }) // initially going backward
```

### Calculating velocity from drag

```tsx
// velocity is in px/s, distance is in px
let normalizedVelocity = velocityTowardTarget / distanceToTarget

spring('bouncy', { velocity: normalizedVelocity })
```

## Iterating for JS Animations

The spring iterator yields position values from 0 to 1, one per frame (~60fps):

```tsx
let s = spring('bouncy')

for (let t of s) {
  console.log(t) // 0, 0.015, 0.058, 0.121, ... 1
}
```

### Interpolating between values

Use the 0→1 progress to interpolate any value:

```tsx
let from = 100
let to = 500

for (let t of spring('bouncy')) {
  let value = from + (to - from) * t // 100 → 500
  updateSomething(value)
  await nextFrame()
}
```

### Canvas animation

```tsx
let s = spring('bouncy')

function draw() {
  let { value, done } = s.next()

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.beginPath()
  ctx.arc(value * 400, 100, 20, 0, Math.PI * 2) // x: 0 → 400
  ctx.fill()

  if (!done) requestAnimationFrame(draw)
}

draw()
```

### Animating multiple properties

```tsx
let fromX = 0,
  toX = 200
let fromY = 0,
  toY = 100
let fromScale = 0.5,
  toScale = 1

for (let t of spring('bouncy')) {
  let x = fromX + (toX - fromX) * t
  let y = fromY + (toY - fromY) * t
  let scale = fromScale + (toScale - fromScale) * t

  render({ x, y, scale })
  await nextFrame()
}
```

### Color interpolation

```tsx
let fromRGB = [255, 0, 0] // red
let toRGB = [0, 0, 255] // blue

for (let t of spring('smooth')) {
  let r = Math.round(fromRGB[0] + (toRGB[0] - fromRGB[0]) * t)
  let g = Math.round(fromRGB[1] + (toRGB[1] - fromRGB[1]) * t)
  let b = Math.round(fromRGB[2] + (toRGB[2] - fromRGB[2]) * t)

  element.style.backgroundColor = `rgb(${r}, ${g}, ${b})`
  await nextFrame()
}
```

## Accessing Raw Values

```tsx
let { duration, easing } = spring('bouncy')

// duration: 550 (ms)
// easing: "linear(0.0000, 0.0156, ...)"
```

## Accessing Preset Defaults

```tsx
spring.presets
// {
//   smooth: { duration: 400, bounce: -0.3 },
//   snappy: { duration: 200, bounce: 0 },
//   bouncy: { duration: 300, bounce: 0.3 }
// }
```

## Web Animations API

```tsx
element.animate(keyframes, {
  ...spring('bouncy'),
})
```

## Complete Example

```tsx
function AnimatedCard(handle: Handle) {
  let isExpanded = false

  return () => (
    <div
      css={{
        transition: spring.transition(['width', 'height'], 'bouncy'),
      }}
      style={{
        width: isExpanded ? '300px' : '100px',
        height: isExpanded ? '200px' : '100px',
      }}
      on={{
        click() {
          isExpanded = !isExpanded
          handle.update()
        },
      }}
    >
      Click me
    </div>
  )
}
```
