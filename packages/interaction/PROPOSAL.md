This proposal has the following goals:

- Avoid global registry for custom “interactions”
- Avoid `[interaction](event) {…}` syntax for interaction listening
- Restore support for “event descriptor factories” (e.g. `on.click(fn)`) while keeping the new string-keyed API (e.g. `{ click: fn }`)

I believe these goals reflect the main concerns people have about the latest Events API (`@remix-run/interaction@0.1.0`).

## 1. Introduce `Interaction` type

Change `defineInteraction` to return a type-safe function, instead of a string.

```ts
import { defineInteraction, type Interaction } from '@remix-run/interaction'

// Assume `Press` and `PressEvent` are identical to what you see in ./src/lib/interactions/press.ts
const longPress = defineInteraction<PressEvent>('rmx:long-press', Press)

longPress satisfies Interaction<PressEvent> // New return type
```

This change…

- removes the need for `interface HTMLElementEventMap {…}` extensions
- removes the need for a global runtime registry for custom interactions

> [!NOTE]
> Use of `satisfies` in this proposal is purely illustrative. You won't need it when using these APIs in your code. Read it as "this variable ABC is inferred to be of type XYZ".

#### Usage

An example of using an interaction with a JSX element:

```tsx
return (
  <button
    on={{
      click(event) {…},
      ...longPress(event => {…}),
    }}
  >Click me</button>
)
```

The `longPress()` interaction returns a type-safe event descriptor:

```ts
longPress(…) satisfies {
  'rmx:long-press': (event: PressEvent) => void
}
```

If the `...` spread syntax feels jarring to you, note that you can nest it in an array instead. Before you roll your eyes, note that the new `on()` function (described in the next section) is yet another alternative syntax that you might prefer. The key here is to be flexible, as it lets developers choose the syntax that feels most natural to them, and it's more forgiving to agentic coding.

```tsx
<button
  on={[
    {
      click(event) {…},
    },
    longPress(event => {…}),
  ]}
>Click me</button>
```

## 2. Make `on()` multi-purpose

The `on()` function can be used 1 of 2 ways:
- Add one or more listeners to an event target
- Declare an event descriptor (when no event target is provided)

When declaring event listeners with JSX, you don't provide an event target:

```tsx
import { on } from '@remix-run/interaction'
import { longPress } from '@remix-run/interaction/press'

function MyButton(this: Remix.Handle) {
  return (
    <button
      on={[
        on.click((event) => {
          event satisfies MouseEvent
          event.type satisfies 'click'
          event.currentTarget satisfies HTMLButtonElement
        }),
        // Example of listener options
        on.focus({ once: true }, (event) => {…}),
        // Example of a custom interaction
        longPress((event) => {
          event satisfies PressEvent
          event.type satisfies 'rmx:long-press'
          event.currentTarget satisfies HTMLButtonElement
        }),
      ]}
    >
      Click me
    </button>
  )
}
```

**Importantly**, you can still pass a listeners object to the `on` prop. This API will feel more natural to beginners.

```tsx
<button
  on={{
    click(event) {…},
    focusin: capture(event => {…}),
  }}>
  Click me
</button>
```

### Forwarding the `on` prop

Your components may want to accept an `on` prop and forward it to a child JSX element. This is easy if we add nesting support. Essentially, the reconciler will flatten the array of listeners into a single object.

```tsx
function Foo(props: {
  on?: Remix.EventListeners<HTMLButtonElement>
}) {
  return (
    <button on={[
      props.on,
      on.click(event => {…}),
    ]}>
      Click me
    </button>
  )
}
```

### Targeted `on()` calls

The current `on()` API is largely unchanged, but it now supports the same values as the new JSX `on` prop.

When `on()` receives an event target as the first argument, the listeners are immediately added to the target.

```ts
import { longPress } from '@remix-run/interaction/press'
import { on, capture } from '@remix-run/interaction'

// Basic API: Multiple listeners
const dispose = on(target, signal, {
  foo(event) {…},
  bar: capture(event => {…}),
})

// Basic API: Single listener
const dispose = on.foo(target, signal, event => {…})

// Advanced API
const dispose = on(target, signal, [
  on.foo(event => {…}),
  on.bar({ capture: true }, event => {…}),
  longPress(event => {…}),
  {
    foo(event) {…},
    bar: capture(event => {…}),
  }
])
```
