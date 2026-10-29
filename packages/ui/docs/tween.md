# Tween API

## API Reference

```ts
interface BezierCurve {
  x1: number // First control point X (0-1)
  y1: number // First control point Y
  x2: number // Second control point X (0-1)
  y2: number // Second control point Y
}
```

## When to Use

Use `tween` for:

- Canvas/WebGL animations
- Complex sequenced animations
