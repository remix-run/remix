# Testing

Read before adding tests or changing the app's test command.

Installed API docs: `src/test/README.md` for runner setup/discovery, `src/ui/test/README.md` for browser component tests, `src/node-fetch-server/README.md` for real HTTP test servers, and `src/cli/README.md` for configuration. Prefer those examples over duplicating runner options here.

## Verify the Runner First

The scaffold's `test` script is `NODE_ENV=test remix test`, and it ships `app/actions/controller.test.ts` as a smoke test. Tests import `describe`/`it` from `remix/test` and assertions from `remix/assert`. If an app instead runs `node --test`, its tests must import `node:test`; do not mix the two, and do not switch an established suite without migrating its imports and lifecycle setup. Node's runner reports a passing file without executing bodies registered through `remix/test`, so check test counts in the output, not just the exit code.

Read the installed runner README before adding setup dependencies or replacing discovery patterns. Its default patterns include server, `.test.browser.tsx`, and `.test.e2e.ts` tests. If the app overrides `test.files` in `remix.json`, make sure it still includes the intended browser/e2e files and type classifications.

## Choose the Narrowest Meaningful Layer

| Behavior                                                    | Test                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| Pure helper                                                 | Colocated unit test                                         |
| Routing, validation, redirects, authorization, persistence  | `router.fetch(new Request(...))`                            |
| Real HTTP origin, streaming, network redirects/cookies      | `createTestServer(...)` from `remix/node-fetch-server/test` |
| Local component interaction/lifecycle                       | `.test.browser.tsx` using `remix/ui/test`                   |
| Hydration, navigation, enhanced forms across server/browser | E2E test using the runner's browser/server support          |

Place root controller tests at `app/actions/controller.test.ts(x)` and nested controller tests beside their controller. Use `test/` only for shared fixtures or integration helpers. Test the behavior, not internal hydration markers or incidental markup.

## Router Tests and Isolation

A stateless test can use the existing app router, as the scaffold's smoke test does:

```ts
// app/actions/controller.test.ts
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { router } from '../router.ts'
import { routes } from '../routes.ts'

describe('root controller', () => {
  it('GET / returns the home page', async () => {
    let response = await router.fetch(new URL(routes.home.href(), 'http://localhost'))

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/)
    assert.match(await response.text(), /<html[\s>]/)
  })
})
```

For stateful behavior, export an app-owned router factory (for example `createAppRouter(options)` in `app/router.ts`) that accepts fresh session storage and database dependencies, and build one per suite. A new router alone does not isolate resources imported as module singletons; the factory has to accept them as parameters.

Use a test cookie and `createMemorySessionStorage()` for session tests. For a CSRF-protected form, first GET the form, retain the response's cookie, then submit its token with the same cookie. An in-process router request does not maintain a browser cookie jar for you.

Assert the status, redirect `Location`, safe error body, and mutation side effects that define the behavior. Add rejection cases for auth, ownership, invalid input, and limits as appropriate; one happy-path test is not sufficient for a security boundary.

Register cleanup with `t.after(...)` or an equivalent lifecycle hook so it runs after assertion failures. Close real HTTP servers, database clients, asset watchers, and temporary storage. A module import that starts a watcher or connects to production data is a fixture-design problem, not something to hide with a timeout.

## Browser Component Tests

Name browser tests `*.test.browser.tsx` so the Remix runner provides a live browser rather than a Node process with no DOM. Read the installed test README for Playwright setup and project selection; do not add a DOM shim to work around the wrong test environment.

For the `Counter` in [component model](component-model.md), colocate a browser test:

```tsx
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { render } from 'remix/ui/test'

import { Counter } from './counter.tsx'

describe('Counter', () => {
  it('increments on activation', async (t) => {
    let result = render(<Counter label="Count" />)
    t.after(result.cleanup)

    let button = result.$('button')
    assert.ok(button)
    await result.act(() => button.click())

    assert.equal(button.textContent, 'Count: 1')
  })
})
```

`render(...)` flushes the initial tree. Await `act(...)` for interactions and await the relevant async operation inside it before asserting; it does not magically wait for every outstanding fetch. Use `createRoot(...)`/`root.flush()` only when a test needs lower-level control.

Use native DOM interactions. Verify removal/cleanup and keyboard/focus behavior when those are part of the component's contract. For a form that gains enhancement, test success **and** server-rendered validation errors with JavaScript on and off; a component unit test cannot prove that integration.

Run the focused tests and the app's typecheck script. Use the installed runner's `--only` or file filters for a tight loop, and report which test environments were actually exercised.
