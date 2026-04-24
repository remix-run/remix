# Testing

## What This Covers

How to test the two layers most Remix code lives in: HTTP behavior and DOM behavior. Read this when
the task involves:

- Driving the router with `router.fetch(new Request(...))` and asserting on the returned `Response`
- Building a fresh router per test for session, storage, or database isolation
- Rendering components into a real DOM with `createRoot` and synchronizing with `root.flush()`
- Choosing which layer to test for a given behavior

For session and auth test setup, see `auth-and-sessions.md`. For component lifecycle, see
`component-model.md`.

## Two Shapes

Remix tests run with the `remix-test` CLI (from `remix/test`) and use `remix/assert` for
assertions. Two main shapes:

- **Server / router tests** — drive the router with `router.fetch(new Request(...))` and assert
  on the returned `Response`. No DOM, no browser harness.
- **Component tests** — render a component into a real DOM `Element` with `createRoot`, then call
  `root.flush()` between interactions.

## Server / Router Tests

Treat the router as a pure `(Request) => Promise<Response>` function. Build a fresh app router
per test (or per suite) so middleware state — sessions, in-memory storage, the database — stays
isolated.

```ts
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createBookstoreRouter } from '../app/router.ts'
import { routes } from '../app/routes.ts'

describe('home', () => {
  it('responds 200 with the home page', async () => {
    let router = createBookstoreRouter()
    let response = await router.fetch(new Request('http://localhost' + routes.home.href()))

    assert.equal(response.status, 200)
    assert.match(await response.text(), /Welcome to the Bookstore/)
  })
})
```

Use `routes.<name>.href(...)` to build URLs in tests so they stay in sync with the route
definition. For form-style POSTs, attach a `FormData` body to the `Request`. For tests that need
a known session, swap in `createMemorySessionStorage()` and a test cookie when constructing the
router.

```ts
import { createMemorySessionStorage } from 'remix/session/memory-storage'
import { createCookie } from 'remix/cookie'

let router = createBookstoreRouter({
  sessionCookie: createCookie('session', { secrets: ['test'] }),
  sessionStorage: createMemorySessionStorage(),
})
```

## Component Tests

Use `createRoot(container)` and `root.flush()`. `flush()` synchronously executes all pending
updates and tasks, ensuring the DOM and component state are fully synchronized before assertions.

### Basic pattern

```tsx
import * as assert from 'remix/assert'
import { createRoot } from 'remix/component'

let container = document.createElement('div')
let root = createRoot(container)

root.render(<Counter />)
root.flush()

let button = container.querySelector('button')!
button.click()
root.flush()

assert.match(container.textContent ?? '', /1/)
```

### Why flush

- **After initial render** — ensures event listeners are attached and the DOM is ready for
  interaction.
- **After interactions** — applies updates from `handle.update()` calls triggered by events.
- **After async work resolves** — applies updates from resolved `queueTask(...)` callbacks.

### Async operations

For components with async operations in `queueTask`, flush after each step:

```tsx
let root = createRoot(container)
root.render(<AsyncLoader />)
root.flush()

assert.equal(container.textContent, 'Loading...')

await waitForFetch()
root.flush()

assert.equal(container.textContent, 'Expected data')
```

### Component removal

Use `root.dispose()` to remove the component tree and verify cleanup behavior:

```tsx
root.render(<MyComponent />)
root.flush()

assert.ok(container.querySelector('.content'))

root.dispose()
assert.equal(container.innerHTML, '')
```

### Guidelines

- Prefer real DOM interactions over mocking framework behavior.
- Avoid testing implementation-only markers unless they are the only stable synchronization point.
- One representative flow proving a behavior is better than repeating the same assertion across many
  paths.
