# Animate API

Declarative animations for element lifecycle and layout changes. The `animate` prop handles three types of animations:

- **Enter**: Animation played when an element mounts
- **Exit**: Animation played when an element is removed (element persists until animation completes)
- **Layout**: FLIP animation when an element's position or size changes

## How It Works

The `animate` prop is an intrinsic property that wraps the Web Animations API (`element.animate()`). The reconciler handles the complexity:

- **Enter**: Element animates from the specified keyframe(s) to its natural styles
- **Exit**: Element animates from its current styles to the specified keyframe(s)
- **Layout**: Element smoothly animates from old position/size to new using FLIP technique
- **DOM persistence**: When a vnode is removed, the element stays in the DOM until the exit animation finishes
- **Interruption**: If an animation is interrupted mid-flight, it reverses from its current position rather than jumping to the other animation

## Basic Usage

### Default animations

Use `true` to enable default animations for each type:

```tsx
<div animate={{ enter: true, exit: true, layout: true }}>Hello</div>
```

This enables:

- **Enter**: Fade in (150ms, ease-out)
- **Exit**: Fade out (150ms, ease-in)
- **Layout**: FLIP position/size animation (200ms, ease-out)

Mix and match as needed:

```tsx
<div animate={{ enter: true, exit: true }}>Fade in/out, no layout</div>
<div animate={{ layout: true }}>Only layout animation</div>
<div animate={{ exit: true }}>Only exit animation</div>
```

### Single keyframe (shorthand)

The `enter` keyframe defines the **starting state**—the element animates **from** these values **to** its natural styles. The `exit` keyframe defines the **ending state**—the element animates **from** its current styles **to** these values:

```tsx
<div
  animate={{
    enter: { opacity: 0, transform: 'scale(0.85)', duration: 200, easing: 'ease-out' },
    exit: { opacity: 0, duration: 150 },
  }}
>
  Modal content
</div>
```

### Multi-step animations

For complex sequences, provide an array of keyframes:

```tsx
<div
  animate={{
    enter: {
      keyframes: [
        { opacity: 0, transform: 'scale(0.8)' },
        { opacity: 1, transform: 'scale(1.05)', offset: 0.7 },
        { opacity: 1, transform: 'scale(1)' },
      ],
      duration: 300,
      easing: 'ease-out',
    },
    exit: {
      opacity: 0,
      transform: 'scale(0.9)',
      duration: 150,
    },
  }}
>
  Toast notification
</div>
```

### Conditional animations

Use falsy values to disable animations conditionally. This is useful for skipping the enter animation on initial render:

```tsx
<div
  animate={{
    enter: shouldAnimate && { opacity: 0, duration: 200 },
    exit: { opacity: 0, duration: 150 },
  }}
>
  Content
</div>
```

When `enter` is falsy (`false`, `null`, `undefined`), the element appears instantly with no animation. The exit animation still plays when the element is removed.

## Common Patterns

### Slide down from top

```tsx
<div
  animate={{
    enter: { opacity: 0, transform: 'translateY(-10px)', duration: 150 },
    exit: { opacity: 0, transform: 'translateY(-10px)', duration: 200 },
  }}
>
  Dropdown menu
</div>
```

### Slide with blur (icon swap)

```tsx
let iconAnimation = {
  enter: {
    transform: 'translateY(-40px) scale(0.5)',
    filter: 'blur(6px)',
    duration: 100,
    easing: 'ease-out',
  },
  exit: {
    transform: 'translateY(40px) scale(0.5)',
    filter: 'blur(6px)',
    duration: 100,
    easing: 'ease-in',
  },
}

// Use for swapping icons or labels - keys enable smooth cross-fade
{
  state === 'loading' ? (
    <span key="loading" animate={iconAnimation}>
      <Loader />
    </span>
  ) : (
    <span key="success" animate={iconAnimation}>
      <Check />
    </span>
  )
}
```

### Enter only (no exit animation)

Element animates in but disappears instantly when removed:

```tsx
<div animate={{ enter: { opacity: 0, duration: 200 } }}>One-way animation</div>
```

### Exit only (no enter animation)

Element appears instantly but animates out:

```tsx
<div animate={{ exit: { opacity: 0, duration: 300 } }}>Fade out only</div>
```

### With delay

Stagger animations or wait before starting:

```tsx
<div
  animate={{
    enter: { opacity: 0, duration: 200, delay: 100 },
    exit: { opacity: 0, duration: 150 },
  }}
>
  Delayed entrance
</div>
```

## Interruption Handling

If a user toggles an element before its animation finishes, the current animation reverses from its current position rather than jumping to the other animation. This creates smooth, interruptible transitions.

```tsx
// User clicks "Toggle" to show element
// Enter animation starts: opacity 0 → 1
// User clicks "Toggle" again at opacity 0.4
// Animation reverses: opacity 0.4 → 0 (doesn't jump to exit animation)
```

If an exit animation is interrupted, it reverses and the node is reclaimed back into the virtual DOM.

**Important**: For reclamation to work, the element must have a `key` prop:

```tsx
// Reclamation works - element can be interrupted and reused
{
  show && (
    <div key="panel" animate={{ enter: true, exit: true }}>
      ...
    </div>
  )
}

// No reclamation - element is recreated each time
{
  show && <div animate={{ enter: true, exit: true }}>...</div>
}
```

Without a key, the reconciler can't determine if a new element should reclaim an exiting one, so interrupting an exit animation will still remove the old element and create a new one.

## With Spring Easing

Spread a spring value to get physics-based `duration` and `easing`:

```tsx
import { spring } from 'remix/component'

let el = (
  <div
    animate={{
      enter: {
        opacity: 0,
        transform: 'scale(0.9)',
        ...spring('bouncy'),
      },
      exit: {
        opacity: 0,
        ...spring('snappy'),
      },
    }}
  >
    Bouncy modal
  </div>
)
```

See [Spring API](./spring.md) for available presets and custom spring options.

## Complete Example

A toggle component with animate:

```tsx
import { createRoot, type Handle } from 'remix/component'

function ToggleContent(handle: Handle) {
  let show = false

  return () => (
    <>
      <button
        on={{
          click() {
            show = !show
            handle.update()
          },
        }}
      >
        Toggle
      </button>

      {show && (
        <div
          key="content"
          animate={{
            enter: {
              keyframes: [
                { opacity: 0, transform: 'translateY(-10px)', transformOrigin: 'top left' },
                { opacity: 1, transform: 'translateY(0)', transformOrigin: 'top left' },
              ],
              duration: 80,
              easing: 'ease-out',
              delay: 100,
            },
            exit: {
              opacity: 0,
              duration: 120,
              easing: 'ease-in',
            },
          }}
        >
          Content that animates in and out
        </div>
      )}
    </>
  )
}
```

## Layout Animations

The `layout` property enables automatic FLIP (First, Last, Invert, Play) animations when an element's position or size changes due to layout shifts. Instead of the element jumping to its new position, it smoothly animates there.

### Basic Usage

Enable layout animations with `layout: true`:

```tsx
<div animate={{ layout: true }}>Animates position/size changes</div>
```

Or customize duration and easing, including springs:

```tsx
import { spring } from 'remix/component'

let custom = (
  <div
    animate={{
      layout: {
        duration: 300,
        easing: 'ease-in-out',
      },
    }}
  >
    Ease
  </div>
)

let springEasing = (
  <div
    animate={{
      layout: spring('bouncy'),
    }}
  >
    Bouncy
  </div>
)
```

### How It Works

Layout animations use the FLIP technique:

1. **First**: Before any DOM changes, the element's current position is captured
2. **Last**: After DOM changes, the new position is measured
3. **Invert**: A CSS transform is applied to make the element appear at its old position
4. **Play**: The transform animates to identity, moving the element to its new position

This approach is performant because it only animates `transform` (and optionally `scale`), which are GPU-accelerated and don't trigger layout recalculations.

### What Gets Animated

Layout animations handle:

- **Position changes**: Moving left/right/up/down via `translate3d()`
- **Size changes**: Width/height changes via `scale()`

### Example: Toggle Switch

A classic use case is animating a toggle knob when its `justify-content` changes:

```tsx
function FlipToggle(handle: Handle) {
  let isOn = false

  return () => (
    <button
      css={{
        width: 100,
        height: 50,
        backgroundColor: 'rgba(153, 17, 255, 0.2)',
        borderRadius: 50,
        display: 'flex',
        padding: 10,
      }}
      style={{
        justifyContent: isOn ? 'flex-start' : 'flex-end',
      }}
      on={{
        click() {
          isOn = !isOn
          handle.update()
        },
      }}
    >
      <div
        css={{
          width: 30,
          height: 30,
          backgroundColor: '#9911ff',
          borderRadius: '50%',
        }}
        animate={{
          layout: { ...spring({ duration: 200, bounce: 0.2 }) },
        }}
      />
    </button>
  )
}
```

When clicked, the knob smoothly slides from one side to the other instead of jumping.

### Example: List Reordering

Layout animations shine when reordering list items:

```tsx
function ReorderableList(handle: Handle) {
  let items = [
    { id: 'a', name: 'Apple' },
    { id: 'b', name: 'Banana' },
    { id: 'c', name: 'Cherry' },
  ]

  function shuffle() {
    items = [...items].sort(() => Math.random() - 0.5)
    handle.update()
  }

  return () => (
    <div>
      <button on={{ click: shuffle }}>Shuffle</button>
      <ul>
        {items.map((item) => (
          <li
            key={item.id}
            animate={{
              layout: { ...spring('snappy') },
            }}
          >
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

Each item animates to its new position when the list order changes.

### Combining with Enter/Exit

Layout animations work alongside enter/exit animations:

```tsx
<div
  animate={{
    enter: { opacity: 0, duration: 150 },
    exit: { opacity: 0, duration: 150 },
    layout: { ...spring('snappy') },
  }}
>
  Fades in/out and animates position changes
</div>
```

### Interruption

Layout animations are interruptible. If the layout changes again while an animation is in progress:

1. The current animation is cancelled
2. The element's current visual position is captured
3. A new animation starts from that position to the new target

This ensures smooth transitions even during rapid layout changes.

### Configuration Options

```tsx
interface LayoutAnimationConfig {
  duration?: number // Animation duration in ms (default: 200)
  easing?: string // CSS easing function (default: 'ease-out')
}
```

All options are optional—use `layout: true` for defaults, or customize:

```tsx
// Just layout with defaults
animate={{ layout: true }}

// Custom duration only
animate={{ layout: { duration: 300 } }}

// Custom easing only
animate={{ layout: { easing: 'ease-in-out' } }}

// Spring physics
animate={{ layout: { ...spring('bouncy') } }}
```

## Tips

- **Keep durations short**: 100-300ms feels snappy. Longer durations can feel sluggish.
- **Use `ease-out` for enter**: Elements should decelerate as they arrive at their final position.
- **Use `ease-in` for exit**: Elements should accelerate as they leave.
- **Use springs for layout**: Physics-based easing feels natural for position/size changes.
- **Always use `key` for animated elements**: Keys are required for reclamation (interrupting exit to re-enter) and for layout animations to track element identity. Even conditionally rendered elements need keys: `{show && <div key="panel" animate={{ exit: true }} />}`
- **Skip animation on first render**: For elements like labels that shouldn't animate on initial mount, use a falsy value for `enter`:

```tsx
function Label(handle: Handle) {
  let isFirstRender = true
  handle.queueTask(() => {
    isFirstRender = false
  })

  return (props: { text: string }) => (
    <span
      key={props.text}
      animate={{
        enter: !isFirstRender && { opacity: 0, duration: 100, easing: 'ease-out' },
        exit: { opacity: 0, duration: 200, easing: 'ease-in' },
      }}
    >
      {props.text}
    </span>
  )
}
```
