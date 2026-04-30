# Components

All components follow a consistent two-phase structure.

## Component Structure

1. **Component Phase** - Runs once when the component is first created
2. **Render Phase** - Runs on initial render and every update afterward

```tsx
function MyComponent(handle: Handle<Props>) {
  // Component phase: runs once
  let state = initializeState(handle.props)

  // Return render function: runs on every update
  return () => {
    return <div>{/* render content */}</div>
  }
}
```

## Runtime Behavior

When a component is rendered:

1. **First Render**:

   - The component function is called with `handle`
   - The returned render function is stored
   - The render function is called after `handle.props` is populated
   - Any tasks queued via `handle.queueTask()` are executed after rendering

2. **Subsequent Updates**:

   - Only the render function is called
   - Component phase is skipped, and the closure persists for the lifetime of the component instance
   - `handle.props` is updated before the render function is called
   - Tasks queued during the update are executed after rendering

3. **Component Removal**:
   - `handle.signal` is aborted
   - All event listeners registered via `addEventListeners()` are automatically cleaned up
   - Any queued tasks are executed with an aborted signal

## Props On The Handle

Props are available on `handle.props`. The object is stable, and its values are updated before each render:

```tsx
function Counter(handle: Handle<{ initialCount: number; label: string }>) {
  let count = handle.props.initialCount

  return () => {
    return (
      <div>
        {handle.props.label}: {count}
      </div>
    )
  }
}

// Usage
let element = <Counter initialCount={10} label="Count" />
```

## Basic Rendering

The simplest component just returns JSX:

```tsx
function Greeting(handle: Handle<{ name: string }>) {
  return () => <div>Hello, {handle.props.name}!</div>
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
        mix={[
          on('click', () => {
            count++
            handle.update()
          }),
        ]}
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
