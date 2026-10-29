# animation

`animation` provides utilities for entrance, exit, layout, drag, spring, and tween animation. Use these helpers with component mixins, CSS transitions, the Web Animations API, and imperative `requestAnimationFrame` loops.

## Installation

`@remix-run/ui` is currently unstable and versioned independently. It is not available through the `remix` package.

```sh
npm i remix @remix-run/ui
```

## Usage

```tsx
import { animateEntrance, animateExit, animateLayout, spring } from '@remix-run/ui/animation'

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
import { animateEntrance, spring } from '@remix-run/ui/animation'

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

`animateExit` keeps a removed keyed element in the DOM long enough to animate from its natural styles to the provided keyframe. Retained exits are immediately inert, so they cannot receive focus or user interaction and are excluded from the accessibility tree. Reclaiming an element restores its authored inertness before applying its new props. Focus recovery remains the responsibility of the component removing the element.

```tsx
import type { Handle } from 'remix/component'
import { animateExit } from '@remix-run/ui/animation'

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

Style properties describe the entrance's starting values or the exit's destination. Set `duration`, `easing`, `delay` and `composite` alongside them. Custom configurations default to 150 ms with linear easing.

```tsx
animateExit({
  opacity: 0,
  translate: '24px 0',
  zIndex: 101,
  duration: 140,
  easing: 'ease-out',
  transition: {
    zIndex: {
      duration: 0,
    },
  },
})
```

Use `transition` to override settings for individual properties. Each property inherits settings from the animation, replacing only the fields you supply. Spread `spring()` into the animation for shared spring timing, or pass it as a property's transition.

Exit properties with zero duration and no positive delay apply immediately, before the next layout measurement. They support discrete properties such as `position`, layering properties such as `zIndex`, and CSS custom properties. The mixin restores temporary inline styles before a returning element's new props are applied. Entrance properties with zero duration use their natural styles immediately.

An exit waits for every property transition to finish. Removing an element during entrance starts its configured exit from the current animated appearance. Reclaiming a node retargets all active properties to natural styles. Retargeting preserves the current values, but does not carry spring velocity between animations.

Pass `initial: false` to skip only the first keyed entrance for an element within a parent. Later insertions for the same key can still animate.

```tsx
<div
  key={id}
  mix={[
    animateEntrance({
      opacity: 0,
      initial: false,
      duration: 150,
    }),
  ]}
/>
```

Exit animations can reclaim a removed keyed node if the same keyed element is rendered again before the exit finishes. The reclaimed node retargets toward its natural styles instead of simply reversing the exit animation.

For custom teardown, `createMixin` exposes `event.persistNode(callback)` in its `beforeRemove` event. It keeps the host in the DOM until the callback settles and supplies an abort signal for cancellation when a keyed node is reclaimed. See [Deferring removal](https://github.com/remix-run/remix/blob/main/packages/component/README.md#deferring-removal-with-persistnode) for a complete example and lifecycle ordering.

## Layout Animation

`animateLayout` animates layout changes with a FLIP-style transform projection. Use it on elements whose position or size can change between renders.

```tsx
import type { Handle } from 'remix/component'
import { animateLayout, spring } from '@remix-run/ui/animation'

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
<div
  mix={[
    animateLayout({
      size: false,
      duration: 180,
      easing: 'ease-out',
    }),
  ]}
/>
```

Apply custom CSS transforms to a separate wrapper or child element.

Passing `true` or no argument enables the default layout animation. Passing `false`, `null`, or `undefined` disables it. Layout animation skips work when geometry does not change, keeps in-flight animations running when their target geometry has not changed, and continues from the current visual transform when a new layout change interrupts an active animation.

## Drag

`drag()` adds pointer dragging with momentum. Use `axis` to select an axis, or `directionLock` to choose one from the initial gesture. Constraints accept local pixel offsets or a function returning a containing element. `elasticity` controls how far the element follows the pointer beyond its bounds, from 0 for a hard edge to 1 for full movement. It can also be configured per edge.

```tsx
import { animateLayout, drag } from '@remix-run/ui/animation'

function DraggableItem() {
  return () => (
    <li
      mix={[
        animateLayout({ size: false }),
        drag({
          axis: 'y',
          snapToOrigin: true,
          stiffness: 450,
          dampingRatio: 0.7,
        }),
      ]}
    >
      Review changes
    </li>
  )
}
```

Drag, entrance, exit and layout mixins can share an element. A gesture takes over its active position axes from entrance or release playback. Layout changes preserve the held position. Use `translate` for presence movement that a gesture should take over. A raw `transform` remains an independent effect.

### Constraints

For element constraints, capture the container with `ref()` and pass a resolver:

```tsx
import { drag } from '@remix-run/ui/animation'
import { ref } from 'remix/component'

function DraggableTile() {
  let container: HTMLElement | undefined

  return () => (
    <div
      mix={ref((node: HTMLElement) => {
        container = node
      })}
    >
      <div mix={drag({ constraints: () => container })} />
    </div>
  )
}
```

CSS supplies the container and tile dimensions and initial layout. The resolver reads the mounted element when a gesture starts. The mixin measures both elements to keep smaller tiles inside the container and pan larger content between its edges. Element constraints track resizing and preserve relative position within the available travel range. Returning `undefined` leaves movement unbounded.

Alternatively, pass translation bounds relative to the element's layout position:

```tsx
drag({ constraints: { left: -100, right: 100, top: -60, bottom: 60 } })
```

Negative values allow translation left or up; positive values allow translation right or down. Omitted edges remain unbounded. A resolver can also return a bounds object.

### Release behavior

Momentum is enabled by default. Set `momentum: false` to retain the release position within constraints, or `snapToOrigin: true` to spring back. Set `elasticity: 0` to stop at constraint edges without bouncing, including during momentum and spring-driven release. This also works per edge.

`friction` controls how quickly released momentum slows down. Higher values shorten the glide. It is an exponential decay rate per second with a default of `2`. At `2`, velocity falls to about 14% after one second. Nonpositive or nonfinite values use the default.

`modifyTarget(target, axis)` adjusts the projected destination in local pixels before constraints apply. Adjusted destinations follow a decaying momentum curve.

`stiffness` (default `158`) and `dampingRatio` (default `1`) control origin-return and boundary-return springs. A damping ratio below `1` allows oscillation, `1` is critical damping, and values above `1` are overdamped. At `0`, the spring has no damping.

Compose `onDragStart`, `onDrag` and `onDragEnd` listener mixins with `drag()`. They receive a `DragStartEvent`, `DragEvent` or `DragEndEvent` directly, plus an `AbortSignal` that aborts when that listener runs again or is removed. The bubbling DOM events are named `rmx:drag-start`, `rmx:drag` and `rmx:drag-end`; ancestor mixins and native document listeners can observe them too. These are separate from native HTML drag-and-drop events.

Each event carries `point`, `delta`, `offset` and `velocity`: client pointer position, movement since the previous sample, displacement since pointer-down and velocity in pixels per second. Both axes are measured independently of translation, layout movement, locking, constraints and elasticity. `axis` reports the configured or direction-locked axis, or `undefined` for both.

Use the start, move and end events to implement interaction-specific intent, such as cancelling swipe dismissal after a reversal and allowing a renewed forward swipe. Keep this recognition state in the consumer; displacement and velocity alone do not express the sequence of decisions during a gesture.

Start and move events are notifications. The end event fires before settling; call `preventDefault()` synchronously on a normal end to retain the visual position for an exit animation. Preventing it and preventing its `sourceEvent` are independent operations.

`sourceEvent` is the original pointer movement for start/move, or the pointer, keyboard or blur event that ended the gesture. It is `undefined` for lifecycle-driven cancellation such as removal. End events expose `cancelled`; cancellation cannot be prevented. Input cancellation stops momentum and settles within constraints, respecting `snapToOrigin`; removal and exit hand control to cleanup or exit animation instead. Drag automatically skips release animation when reduced motion is preferred.

The mixin exposes `data-dragging` during a recognized gesture and `data-drag-axis` when one axis is selected. Buttons, links, form fields, editable content and descendants marked `data-drag-ignore` do not start a gesture. Provide native controls for operations that also need keyboard access. Reordering, drop targets and edge scrolling remain application responsibilities.

## Reduced Motion

`prefersReducedMotion()` reads the current `prefers-reduced-motion: reduce` media query. It returns `false` during server rendering or when `matchMedia` is unavailable. Call it during render or before starting playback so each check uses the current preference.

```tsx
import { animateLayout, prefersReducedMotion, spring } from '@remix-run/ui/animation'

function Card() {
  return () => (
    <section
      mix={animateLayout(
        prefersReducedMotion()
          ? false
          : {
              ...spring('snappy'),
            },
      )}
    >
      Details
    </section>
  )
}
```

The helper returns a snapshot; it does not subscribe to preference changes or update components. Entrance, exit and layout mixins do not check the preference automatically. Drag checks it for release animation. For CSS transitions, use the `@media (prefers-reduced-motion: reduce)` media query.

## Spring

`spring` returns a decorated iterator. It can be iterated for JavaScript animation, spread into Web Animations API options, or stringified for CSS transition syntax.

```tsx
import { spring } from '@remix-run/ui/animation'

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

Pass a spring as a mixin’s `transition`, or spread it into WAAPI options.

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

Override preset duration or velocity with the second argument. `velocity` is the initial speed in progress per second, where progress runs from `0` to `1`. Positive values start faster and overshoot more. Negative values start slower, and large ones move away from the target first. To continue a gesture, divide its speed toward the target, in pixels per second, by the remaining distance in pixels.

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
import { easings, tween } from '@remix-run/ui/animation'

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
- `drag(options?)`: pointer dragging with constraints, momentum, snapping and release callbacks.
- `DragOptions`: configuration for drag gestures.
- `DragStartEvent`, `DragEvent`, `DragEndEvent`, `onDragStart`, `onDrag`, and `onDragEnd`: bubbling gesture events and listener mixins.
- `prefersReducedMotion()`: reads the current reduced-motion preference, returning `false` when `matchMedia` is unavailable.
- `spring(preset?, overrides?)`: creates a `SpringIterator` from a named preset.
- `spring(options?)`: creates a `SpringIterator` from explicit spring options.
- `spring.transition(property, presetOrOptions?, overrides?)`: builds one or more CSS transition entries from a spring.
- `spring.presets`: named `smooth`, `snappy`, and `bouncy` spring defaults.
- `tween(options)`: generator that interpolates numeric values over time with a cubic-bezier curve.
- `easings`: common cubic-bezier presets for `tween`.
- `SpringIterator`, `SpringPreset`, `SpringOptions`, `TweenOptions`, and `BezierCurve`: public TypeScript types for spring and tween configuration.

## Behavior Notes

- Animation mixin style properties are copied into WAAPI keyframes. Timing belongs in `transition`. `initial` and `size` remain behaviour options.
- `animateEntrance({ initial: false })` only skips the first keyed entrance tracked for the parent node.
- `animateExit` needs keyed elements when removed nodes may be reclaimed or persisted across list updates.
- `animateLayout({ size: false })` animates translation without scale projection.
- `spring()` yields progress values from `0` to `1`; its `duration` and `easing` properties are enumerable so `{ ...spring() }` works with WAAPI options.
- `tween(...)` yields the initial value first; advance the generator with frame timestamps via `next(timestamp)` and read `done` to detect completion.
