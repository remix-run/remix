# Components

All components follow a consistent two-phase structure.

## Component Structure

1. **Setup Phase** - Runs once when the component is first created
2. **Render Phase** - Runs on initial render and every update afterward

```tsx
function MyComponent(handle: Handle, setup: SetupType) {
  // Setup phase: runs once
  let state = initializeState(setup)

  // Return render function: runs on every update
  return (props: Props) => {
    return <div>{/* render content */}</div>
  }
}
```

## Runtime Behavior

When a component is rendered:

1. **First Render**:

   - The component function is called with `handle` and the `setup` prop
   - The returned render function is stored
   - The render function is called with regular props
   - Any tasks queued via `handle.queueTask()` are executed after rendering

2. **Subsequent Updates**:

   - Only the render function is called
   - Setup phase is skipped, setup closure persists for the lifetime of the component instance
   - Props are passed to the render function
   - The `setup` prop is stripped from props
   - Tasks queued during the update are executed after rendering

3. **Component Removal**:
   - `handle.signal` is aborted
   - All event listeners registered via `handle.on()` are automatically cleaned up
   - Any queued tasks are executed with an aborted signal

## Setup vs Props

The `setup` prop is special—it's only available in the setup phase and is automatically excluded from props. This prevents accidental stale captures:

```tsx
function Counter(handle: Handle, setup: number) {
  // setup prop (e.g., initialCount) only available here
  let count = setup

  return (props: { label: string }) => {
    // props only receives { label } - setup is excluded
    return (
      <div>
        {props.label}: {count}
      </div>
    )
  }
}

// Usage
let element = <Counter setup={10} label="Count" />
```

## Basic Rendering

The simplest component just returns JSX:

```tsx
function Greeting() {
  return (props: { name: string }) => <div>Hello, {props.name}!</div>
}

let el = <Greeting name="World" />
```

## Prop Passing

Props flow from parent to child through JSX attributes:

```tsx
function Parent() {
  return () => <Child message="Hello from parent" count={42} />
}

function Child() {
  return (props: { message: string; count: number }) => (
    <div>
      <p>{props.message}</p>
      <p>Count: {props.count}</p>
    </div>
  )
}
```

## Stateful Updates

State is managed with plain JavaScript variables. Call `handle.update()` to trigger a re-render:

```tsx
function Counter(handle: Handle) {
  let count = 0

  return () => (
    <div>
      <span>Count: {count}</span>
      <button
        on={{
          click() {
            count++
            handle.update()
          },
        }}
      >
        Increment
      </button>
    </div>
  )
}
```

## See Also

- [Handle API](./handle.md) - Complete handle API reference
- [Patterns](./patterns.md) - State management best practices
