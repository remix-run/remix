# Testing

## What This Covers

How to test the two layers most Remix code lives in: HTTP behavior and DOM behavior. Read this when
the task involves:

- Driving the router with `router.fetch(new Request(...))` and asserting on the returned `Response`
- Building a fresh router per test for session, storage, or database isolation
- Rendering components into a real DOM with `render(...)` or `createRoot(...)`
- Configuring `remix test` discovery, excludes, and coverage
- Choosing which layer to test for a given behavior

For session and auth test setup, see `auth-and-sessions.md`. For component lifecycle, see
`component-model.md`.

## Two Shapes

Remix tests run with `remix test`, use `remix/test` for the test framework, and use
`remix/assert` for assertions. Two main shapes:

- **Server / router tests** — drive the router with `router.fetch(new Request(...))` and assert
  on the returned `Response`. No DOM, no browser harness.
- **Component tests** — render a component into a real DOM `Element` with `render(...)`, or use
  `createRoot(...)` directly when you need lower-level root control.

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

## Test Runner Config

Configure discovery and coverage in `remix-test.config.ts` or with CLI flags:

```ts
export default {
  glob: {
    test: '**/*.test{,.e2e}.{ts,tsx}',
    e2e: '**/*.test.e2e.{ts,tsx}',
    exclude: 'node_modules/**',
  },
  coverage: {
    dir: '.coverage',
    include: ['app/**/*.{ts,tsx}'],
    exclude: ['app/**/*.test.{ts,tsx}'],
    statements: 80,
    lines: 80,
    branches: 70,
    functions: 80,
  },
}
```

Use `remix test --coverage` to enable coverage with defaults. Use `glob.exclude` when discovery
would otherwise enter generated output, symlinked workspaces, or other paths that should not
produce tests.

## Component Tests

Use `render(...)` from `remix/ui/test` for most component tests. It creates a real DOM container,
flushes the initial render, and returns `act(...)` so interactions can flush pending updates before
assertions. Use `createRoot(container)` from `remix/ui` directly when a test needs explicit control
over root rendering, flushing, or disposal.

### Basic pattern

```tsx
import * as assert from 'remix/assert'
import { render } from 'remix/ui/test'

let result = render(<Counter />)

let button = result.$('button')!
await result.act(() => button.click())

assert.match(result.container.textContent ?? '', /1/)
result.cleanup()
```

### Why act / flush

- **After initial render** — ensures event listeners are attached and the DOM is ready for
  interaction.
- **After interactions** — applies updates from `handle.update()` calls triggered by events.
- **After async work resolves** — applies updates from resolved `queueTask(...)` callbacks.

### Async operations

For components with async operations in `queueTask`, use `act(...)` after each async step:

```tsx
let result = render(<AsyncLoader />)

assert.equal(result.container.textContent, 'Loading...')

await waitForFetch()
await result.act(() => {})

assert.equal(result.container.textContent, 'Expected data')
```

### Component removal

Use `result.cleanup()` or `root.dispose()` to remove the component tree and verify cleanup
behavior:

```tsx
let result = render(<MyComponent />)

assert.ok(result.$('.content'))

result.cleanup()
assert.throws(() => result.$('.content'), /cleaned up/)
```

### Guidelines

- Prefer real DOM interactions over mocking framework behavior.
- Avoid testing implementation-only markers unless they are the only stable synchronization point.
- One representative flow proving a behavior is better than repeating the same assertion across many
  paths.
