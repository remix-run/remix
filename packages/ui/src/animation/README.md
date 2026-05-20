# animation

`animation` provides small primitives for entrance, exit, layout, spring, and tween animation. Use these helpers with Remix UI mixins, CSS transitions, the Web Animations API, and imperative `requestAnimationFrame` loops.

## Usage

```tsx
import { animateEntrance, animateExit, animateLayout, spring } from 'remix/ui/animation'

let panelTransition = spring.transition(['opacity', 'transform'], 'snappy')

function Panel() {
  return () => (
    <div
      style={{ transition: panelTransition }}
      mix={[
        animateEntrance({ opacity: 0, duration: 120 }),
        animateExit({ opacity: 0, duration: 120 }),
        animateLayout(),
      ]}
    >
      Saved filters
    </div>
  )
}
```

## Entrance And Exit

`animateEntrance` animates an element from the provided keyframe into its natural styles when the element is inserted.

```tsx
import { animateEntrance, spring } from 'remix/ui/animation'

function Toast() {
  return () => (
    <div
      mix={[
        animateEntrance({
          opacity: 0,
          transform: 'translateY(8px)',
          ...spring('snappy'),
        }),
      ]}
    >
      Saved
    </div>
  )
}
```

`animateExit` keeps a removed keyed element in the DOM long enough to animate from its natural styles to the provided keyframe.

```tsx
import type { Handle } from 'remix/ui'
import { animateExit } from 'remix/ui/animation'

function Item(handle: Handle<{ id: string; label: string }>) {
  return () => (
    <li
      key={handle.props.id}
      mix={[
        animateExit({
          opacity: 0,
          transform: 'scale(0.96)',
          duration: 120,
          easing: 'ease-in',
        }),
      ]}
    >
      {handle.props.label}
    </li>
  )
}
```

Passing `true` uses the default opacity animation. Passing `false`, `null`, or `undefined` disables the animation.

```tsx
<div mix={[animateEntrance(true), animateExit(false)]} />
```

Animation configs combine WAAPI timing options with style properties for the animated keyframe.

```ts
type AnimateMixinConfig = {
  duration: number
  easing?: string
  delay?: number
  composite?: CompositeOperation
  initial?: boolean
  [property: string]: unknown
}
```

Pass `initial: false` to skip only the first keyed entrance for an element within a parent. Later insertions for the same key can still animate.

```tsx
<div key={id} mix={[animateEntrance({ opacity: 0, duration: 150, initial: false })]} />
```

Exit animations can reclaim a removed keyed node if the same keyed element is rendered again before the exit finishes. The reclaimed node retargets toward its natural styles instead of simply reversing the exit animation.

## Layout Animation

`animateLayout` animates layout changes with a FLIP-style transform projection. Use it on elements whose position or size can change between renders.

```tsx
import type { Handle } from 'remix/ui'
import { animateLayout, spring } from 'remix/ui/animation'

function Card(handle: Handle<{ expanded: boolean }>) {
  return () => (
    <section
      class={handle.props.expanded ? 'card expanded' : 'card'}
      mix={[
        animateLayout({
          ...spring('smooth'),
        }),
      ]}
    >
      Details
    </section>
  )
}
```

Pass `size: false` when the element should animate position only and avoid scale projection.

```tsx
<div mix={[animateLayout({ duration: 180, easing: 'ease-out', size: false })]} />
```

Passing `true` or no argument enables the default layout animation. Passing `false`, `null`, or `undefined` disables it. Layout animation skips work when geometry does not change, keeps in-flight animations running when their target geometry has not changed, and continues from the current visual transform when a new layout change interrupts an active animation.

## Spring

`spring` returns a decorated iterator. It can be iterated for JavaScript animation, spread into Web Animations API options, or stringified for CSS transition syntax.

```tsx
import { spring } from 'remix/ui/animation'

spring('bouncy')
spring('snappy')
spring('smooth')
spring({ duration: 400, bounce: 0.3 })
```

```ts
interface SpringIterator extends IterableIterator<number> {
  duration: number
  easing: string
  toString(): string
}
```

Use `spring.transition` to build CSS transition entries.

```tsx
let transition = spring.transition(['opacity', 'transform'], 'bouncy')

function Button() {
  return () => <button style={{ transition }}>Save</button>
}
```

Spread a spring into animation mixin or WAAPI options.

```tsx
<div
  mix={[
    animateEntrance({
      opacity: 0,
      transform: 'scale(0.92)',
      ...spring('bouncy'),
    }),
  ]}
/>
```

```ts
element.animate(
  [
    { opacity: 0, transform: 'scale(0.92)' },
    { opacity: 1, transform: 'scale(1)' },
  ],
  { ...spring('snappy') },
)
```

Use the iterator values as progress from `0` to `1` for imperative animation.

```ts
let from = 0
let to = 200

for (let progress of spring('bouncy')) {
  let x = from + (to - from) * progress
  element.style.transform = `translateX(${x}px)`
  await nextFrame()
}
```

The built-in presets are:

| Preset   | Bounce | Duration | Character                |
| -------- | ------ | -------- | ------------------------ |
| `smooth` | -0.3   | 400ms    | Overdamped, no overshoot |
| `snappy` | 0      | 200ms    | Quick, no overshoot      |
| `bouncy` | 0.3    | 400ms    | Underdamped bounce       |

Override preset duration or velocity with the second argument.

```ts
spring('bouncy', { duration: 300 })
spring('snappy', { velocity: 2 })
```

Use explicit options when you need full control.

```ts
spring({
  duration: 500,
  bounce: 0.35,
  velocity: 0,
})
```

## Tween

`tween` creates a generator that interpolates a numeric value over time with a cubic-bezier curve. Call `next()` once to initialize the generator, then pass `requestAnimationFrame` timestamps into `next(timestamp)`.

```ts
import { easings, tween } from 'remix/ui/animation'

let animation = tween({
  from: 0,
  to: 100,
  duration: 300,
  curve: easings.easeOut,
})

animation.next()

function tick(timestamp: number) {
  let { value, done } = animation.next(timestamp)
  element.style.transform = `translateX(${value}px)`
  if (!done) requestAnimationFrame(tick)
}

requestAnimationFrame(tick)
```

Animate multiple values with separate tweens.

```ts
let xAnimation = tween({ from: 0, to: 100, duration: 500, curve: easings.easeOut })
let scaleAnimation = tween({ from: 1, to: 1.2, duration: 500, curve: easings.easeOut })

xAnimation.next()
scaleAnimation.next()

function tick(timestamp: number) {
  let x = xAnimation.next(timestamp)
  let scale = scaleAnimation.next(timestamp)

  element.style.transform = `translateX(${x.value}px) scale(${scale.value})`

  if (!x.done || !scale.done) {
    requestAnimationFrame(tick)
  }
}
```

The built-in easing presets are cubic-bezier control points matching common CSS timing functions.

```ts
easings.linear
easings.ease
easings.easeIn
easings.easeOut
easings.easeInOut
```

Custom curves use the same control points as CSS `cubic-bezier(x1, y1, x2, y2)`.

```ts
let animation = tween({
  from: 0,
  to: 100,
  duration: 500,
  curve: { x1: 0.68, y1: -0.55, x2: 0.265, y2: 1.55 },
})
```

## API

- `animateEntrance(config?)`: mixin that animates an element when it enters the DOM.
- `animateExit(config?)`: mixin that persists a removed keyed element long enough to run its exit animation.
- `animateLayout(config?)`: mixin that animates layout changes by comparing geometry between renders.
- `spring(preset?, overrides?)`: creates a `SpringIterator` from a named preset.
- `spring(options?)`: creates a `SpringIterator` from explicit spring options.
- `spring.transition(property, presetOrOptions?, overrides?)`: builds one or more CSS transition entries from a spring.
- `spring.presets`: named `smooth`, `snappy`, and `bouncy` spring defaults.
- `tween(options)`: generator that interpolates numeric values over time with a cubic-bezier curve.
- `easings`: common cubic-bezier presets for `tween`.
- `SpringIterator`, `SpringPreset`, `SpringOptions`, `TweenOptions`, and `BezierCurve`: public TypeScript types for spring and tween configuration.

## Behavior Notes

- Animation mixin style properties are copied into WAAPI keyframes; `duration`, `easing`, `delay`, `composite`, and `initial` are treated as options.
- `animateEntrance({ initial: false })` only skips the first keyed entrance tracked for the parent node.
- `animateExit` needs keyed elements when removed nodes may be reclaimed or persisted across list updates.
- `animateLayout({ size: false })` animates translation without scale projection.
- `spring()` yields progress values from `0` to `1`; its `duration` and `easing` properties are enumerable so `{ ...spring() }` works with WAAPI options.
- `tween(...)` yields the initial value first; advance the generator with frame timestamps via `next(timestamp)` and read `done` to detect completion.
