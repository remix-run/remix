# animation

`animation` provides small primitives for entrance, exit, layout, spring, and tween animation. Use these helpers with Remix UI mixins, CSS transitions, and the Web Animations API.

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

## `animation.*`

- `animateEntrance(...)`: mixin that animates an element when it enters the DOM. Pass `initial: false` to skip the first keyed insertion.
- `animateExit(...)`: mixin that keeps a removed keyed element around long enough to run its exit animation.
- `animateLayout(...)`: mixin that animates layout changes by comparing geometry between renders.
- `spring(...)`: returns a decorated iterator with `duration`, `easing`, and `toString()` for CSS and WAAPI usage.
- `spring.transition(...)`: builds one or more CSS transition entries from a spring.
- `spring.presets`: named `smooth`, `snappy`, and `bouncy` spring defaults.
- `tween(...)`: generator that interpolates numeric values over time with a cubic-bezier curve.
- `easings`: common cubic-bezier presets for `tween`.
- `SpringIterator`, `SpringPreset`, `SpringOptions`, `TweenOptions`, and `BezierCurve`: public TypeScript types for spring and tween configuration.

## Behavior Notes

- Exit animations can reclaim a removed keyed node when the same keyed element is rendered again.
- Reclaimed exit nodes animate toward natural styles instead of simply reversing the exit animation.
- `animateLayout({ size: false })` animates translation without scale projection.
- Layout animation skips work when geometry does not change and cancels interrupted in-flight animations.
- `spring()` can be iterated for JavaScript animation, spread into WAAPI options, or stringified into CSS transition syntax.
- `tween(...)` yields the initial value first; advance the generator with frame timestamps via `next(timestamp)` and read `done` to detect completion.
