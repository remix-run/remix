# Testing

When writing tests, use `root.flush()` to synchronously execute all pending updates and tasks. This ensures the DOM and component state are fully synchronized before making assertions.

## Basic Testing Pattern

The main use case is flushing after events that call `handle.update()`. Since updates are asynchronous, you need to flush to ensure the DOM reflects the changes:

```tsx
function Counter(handle: Handle) {
  let count = 0

  return () => (
    <button
      on={{
        click() {
          count++
          handle.update()
        },
      }}
    >
      Count: {count}
    </button>
  )
}

// In your test
let container = document.createElement('div')
let root = createRoot(container)

root.render(<Counter />)
root.flush() // Ensure initial render completes

let button = container.querySelector('button')
button.click() // Triggers handle.update()
root.flush() // Flush to apply the update

expect(container.textContent).toBe('Count: 1')
```

## Why Flush After Initial Render?

You should also flush after the initial `root.render()` to ensure event listeners are attached and the DOM is ready for interaction:

```tsx
let root = createRoot(container)
root.render(<MyComponent />)
root.flush() // Event listeners now attached

// Safe to interact
container.querySelector('button').click()
```

## Testing Async Operations

For components with async operations in `queueTask`, flush after each step:

```tsx
function AsyncLoader(handle: Handle) {
  let data: string | null = null

  handle.queueTask(async (signal) => {
    let response = await fetch('/api/data', { signal })
    let json = await response.json()
    if (signal.aborted) return
    data = json.value
    handle.update()
  })

  return () => <div>{data ?? 'Loading...'}</div>
}

// In your test (with mocked fetch)
let root = createRoot(container)
root.render(<AsyncLoader />)
root.flush()

expect(container.textContent).toBe('Loading...')

// After fetch resolves
await waitForFetch()
root.flush()

expect(container.textContent).toBe('Expected data')
```

## Testing Component Removal

Use `root.remove()` to clean up and verify cleanup behavior:

```tsx
let root = createRoot(container)
root.render(<MyComponent />)
root.flush()

// Verify setup behavior
expect(container.querySelector('.content')).toBeTruthy()

// Remove and verify cleanup
root.remove()
expect(container.innerHTML).toBe('')
```

## See Also

- [Getting Started](./getting-started.md) - Root methods reference
- [Handle API](./handle.md) - `handle.queueTask()` behavior
