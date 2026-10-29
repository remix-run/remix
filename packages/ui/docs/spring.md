# Spring API

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
