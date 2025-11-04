This proposal has the following goals:

- Avoid global registry for custom “interactions”
- Avoid `[interaction](event) {…}` syntax for interaction listening
- Restore support for “event descriptor factories” (e.g. `on.click(fn)`) while keeping the new string-keyed API (e.g. `{ click: fn }`)

I believe these goals reflect the main concerns people have about the latest Events API (`@remix-run/interaction@0.1.0`).

## 1. Introduce `Interaction` type

Change `defineInteraction` to return a type-safe function, instead of a string.

```ts
import { defineInteraction, on, type Interaction } from '@remix-run/interaction'

// Assume `Press` and `PressEvent` are identical to what you see in ./src/lib/interactions/press.ts
const longPress = defineInteraction<PressEvent>('rmx:long-press', Press)

longPress satisfies Interaction<PressEvent> // New return type
```

This change…

- removes the need for `interface HTMLElementEventMap {…}` extensions
- removes the need for a global runtime registry for custom interactions

#### Usage

An example of using an interaction with a JSX element:

```tsx
return (
  <button
    events={{
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
  events={[
    {
      click(event) {…},
    },
    longPress(event => {…}),
  ]}
>Click me</button>
```

## 2. Advanced `on()` function

Repurpose the `on()` function to be a type-safe event descriptor factory.

```ts
const result = on(button, {
  click(event) {
    event.type satisfies 'click'
    event.currentTarget satisfies HTMLButtonElement
  },
  focusin: capture(event => {…}),
})

result satisfies {
  target: HTMLButtonElement,
  events: {
    click: (event: MouseEvent) => void
    focusin: {
      capture: true,
      listener: (event: FocusEvent) => void,
    }
  }
}
```

It's also wrapped with `new Proxy()` for convenient declaration syntax:

```ts
const result = on.click(button, { once: true }, (event) => {
  event.type satisfies 'click'
  event.currentTarget satisfies HTMLButtonElement
})

result satisfies {
  target: HTMLButtonElement
  events: {
    click: {
      once: true
      listener: (event: MouseEvent) => void
    }
  }
}
```

### Inferring the event target

In many cases, the event target can be inferred, so passing an event target as the first argument is optional. This is most beneficial for the new JSX `events` prop (renamed from `on`).

```tsx
import { events } from '@remix-run/interaction'

function MyButton(this: Remix.Handle) {
  return (
    <button
      events={[
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

**Importantly**, you can still pass a listeners object to the `events` prop. This API will feel more natural to beginners.

```tsx
<button
  events={{
    click(event) {…},
    focusin: capture(event => {…}),
  }}>
  Click me
</button>
```

Now, this complicates the type definition of the `events` prop. But **forwarding** a component's `events` prop to a child JSX element is easy if we add nesting support.

```tsx
function Foo(props: {
  events?: Remix.EventsProp<HTMLButtonElement>
}) {
  return (
    <button events={[
      props.events,
      on.click(event => {…}),
    ]}>
      Click me
    </button>
  )
}
```

## 3. Renamed functions

The current `on()` function should be renamed to `events()`.

It should support the same values as the new JSX `events` prop.

```ts
// Basic API
events(target, signal, {
  foo(event) {…},
  bar: capture(event => {…}),
})

// Advanced API
events(target, signal, [
  on.foo(event => {…}),
  on.bar({ capture: true }, event => {…}),
  {
    foo(event) {…},
    bar: capture(event => {…}),
  }
])
```

Also, `events()` can support multiple targets, thanks to the `on()` function.

```ts
events(signal, [
  on.click(button1, event => {…}),
  on.click(button2, event => {…}),
])
```
