## Testing

For component unit tests, use `createRoot(...)` and `root.flush()`.

```tsx
import { createRoot } from 'remix/ui'

let container = document.createElement('div')
let root = createRoot(container)

root.render(<Counter />)
root.flush()

container.querySelector('button')?.click()
root.flush()

expect(container.textContent).toContain('1')
```

Guidelines:

- Flush after initial render so listeners and queued tasks are attached.
- Flush after interactions that call `handle.update()`.
- Flush after async work resolves if the component uses `queueTask(...)`.
- Use `root.dispose()` to verify cleanup behavior when relevant.

## High-Value Patterns

- Minimal component state
- Work in event handlers first
- Use `queueTask` for post-render work
- Use `TypedEventTarget` for granular context or event subscriptions
- Prefer browser or CSS state over JavaScript state for hover or focus when possible

## Avoid

- Testing implementation-only markers unless they are the only stable synchronization point
- Over-mocking framework behavior that can be exercised with real DOM interactions
- Repeating the same navigation assertion across many paths when one representative flow proves the
  behavior
