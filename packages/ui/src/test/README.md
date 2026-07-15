# Test

Use `render` from `remix/ui/test` as the primary way to test components in a live browser through a `remix/test` "browser" test (`*.test.browser.tsx`). It creates a DOM container, renders and flushes the initial component tree, and returns helpers for querying, interacting with, and cleaning up the rendered output.

## Rendering Components

```tsx
import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { on, type Handle } from 'remix/ui'
import { render } from 'remix/ui/test'

function Counter(handle: Handle) {
  let count = 0

  return () => (
    <div>
      <button
        data-action="increment"
        mix={[
          on('click', () => {
            count++
            handle.update()
          }),
        ]}
      >
        Increment
      </button>
      <output data-testid="count">{count}</output>
    </div>
  )
}

describe('Counter', () => {
  it('increments the count', async (t) => {
    let { $, act, cleanup } = render(<Counter />)
    t.after(cleanup)

    expect($('[data-testid="count"]')?.textContent).toBe('0')

    await act(() => $('[data-action="increment"]')?.click())

    expect($('[data-testid="count"]')?.textContent).toBe('1')
  })
})
```

The initial render is already flushed, so the DOM and event listeners are ready when `render`
returns. Wrap interactions that may update component state in `act` and always await it. `act`
waits for the callback and then flushes pending component updates before the next assertion.

### Testing Async Operations

When an interaction starts an async operation, await that operation inside `act` so updates queued
after it resolves are flushed before making assertions:

```tsx
function UserLoader(handle: Handle<{ loadUser(): Promise<{ name: string }> }>) {
  let name = 'No user loaded'

  return () => (
    <div>
      <button
        mix={[
          on('click', async () => {
            let user = await handle.props.loadUser()
            name = user.name
            handle.update()
          }),
        ]}
      >
        Load user
      </button>
      <output>{name}</output>
    </div>
  )
}

it('loads a user', async (t) => {
  let userPromise = Promise.resolve({ name: 'Ada' })
  let { $, act, cleanup } = render(<UserLoader loadUser={() => userPromise} />)
  t.after(cleanup)

  await act(async () => {
    $('button')?.click()
    await userPromise
  })

  expect($('output')?.textContent).toBe('Ada')
})
```

### Querying Rendered Output

The returned query helpers are scoped to the rendered container so you don't have to worry about false positives outside of the rendered component:

```tsx
let { $, $$, container, cleanup } = render(
  <nav>
    <a href="/one">One</a>
    <a href="/two">Two</a>
  </nav>,
)

let nav = $('nav') // container.querySelector('nav')
let links = $$('a') // container.querySelectorAll('a')

expect(nav).toBeTruthy()
expect(links).toHaveLength(2)
expect(container.textContent).toContain('One')

cleanup()
```

Use `$` for the first matching element, `$$` for all matching elements, and `container` when a
DOM assertion does not fit a selector.

### Cleaning Up

Register `cleanup` with the test context so it always runs, including when an assertion fails:

```tsx
it('renders a dialog', (t) => {
  let { $, cleanup } = render(<Dialog />)
  t.after(cleanup)

  expect($('[role="dialog"]')).toBeTruthy()
})
```

`cleanup` disposes the root and removes its container from the document. You can call it directly
when a test needs to assert cleanup behavior.

### Rendering Into an Existing Container

Pass a container when the test needs a specific DOM context:

```tsx
let container = document.createElement('section')
document.body.appendChild(container)

let result = render(<MyComponent />, { container })

expect(result.container).toBe(container)
result.cleanup()
```

## Advanced: Flushing Manually

Most component tests should use `render` and `act`. For lower-level runtime tests that need direct
control over rendering or scheduling, use the returned `root` and call `root.flush()` after an
operation that queues work:

```tsx
let { root, container, cleanup } = render(<MyComponent value="first" />)

root.render(<MyComponent value="second" />)
root.flush()

expect(container.textContent).toContain('second')
cleanup()
```

You can also create and manage a root directly:

```tsx
import { createRoot } from 'remix/ui'

let container = document.createElement('div')
let root = createRoot(container)

root.render(<MyComponent />)
root.flush() // Complete the initial render and attach event listeners

container.querySelector('button')?.click()
root.flush() // Apply updates queued by the interaction

root.dispose()
```

Manual flushing is also useful after an async operation resolves outside an `act` callback:

```tsx
root.render(<AsyncLoader />)
root.flush()

expect(container.textContent).toBe('Loading...')

await waitForFetch()
root.flush()

expect(container.textContent).toBe('Expected data')
```

## See Also

- [Getting Started](https://github.com/remix-run/remix/blob/main/packages/ui/docs/getting-started.md) - Root methods reference
- [Handle API](https://github.com/remix-run/remix/blob/main/packages/ui/docs/handle.md) - `handle.queueTask()` behavior
