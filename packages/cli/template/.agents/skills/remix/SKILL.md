---
name: remix
description: Builds, reviews, and refactors Remix 3 apps using the remix package and remix/* imports. Use for application structure, routing, middleware, data, auth, UI, browser interaction, and tests; not for implementing Remix framework packages.
---

# Build and Review a Remix App

## Find Context and Documentation

Read the relevant installed documentation before using unfamiliar Remix APIs:

1. Read the app's `AGENTS.md`, `package.json`, and `tsconfig.json`, then inspect the code that owns the behavior being changed.
2. Search `node_modules/remix/INDEX.md` by task, export, or keyword, for example `grep -i 'session' node_modules/remix/INDEX.md`.
3. Follow the index to the relevant guide for the workflow, then the package README for exact imports, options, behavior, and examples. If there is no relevant guide, use the API README and existing app patterns.

Treat the installed documentation as canonical, including when it differs from this skill. Do not rely on remembered Remix 2 patterns or online APIs from a newer version. If the installation has no index, inspect its `package.json` exports and matching installed READMEs, source, and types.

## Remix Mental Model

Remix builds on Web APIs such as `Request`, `Response`, `URL`, and `FormData`. Its APIs compose explicitly at runtime; do not assume file-based routing, generated route types, or a mandatory build step.

### Routes, Router, and Controllers

Remix apps generally separate routing into three parts:

- **Routes** define the URL and method contract, including typed URL generation (`app/routes.ts` in the starter).
- **The router** connects routes, middleware, and controllers (`app/router.ts`).
- **Controllers** implement the actions that handle matched routes (`app/actions/`).

This organization applies to server apps and browser apps using the SPA router. Remix's pieces are composable and replaceable; using one does not require adopting the others. Follow the existing app's choices and use the documented starter conventions when establishing a new app.

A minimal server route can return a plain Web `Response`:

```ts
// app/routes.ts
import { get, route } from 'remix/routes'

export const routes = route({
  hello: get('/hello/:name'),
})
```

```ts
// app/actions/controller.ts
import { createController } from 'remix/router'

import { routes } from '../routes.ts'

export default createController(routes, {
  actions: {
    hello(context) {
      return new Response(`Hello, ${context.params.name}!`)
    },
  },
})
```

```ts
// app/router.ts
import { createRouter } from 'remix/router'

import controller from './actions/controller.ts'
import { routes } from './routes.ts'

export const router = createRouter()
router.map(routes, controller)
```

The runtime adapter passes requests to `router.fetch(request)`. Generate URLs from the same route contract: `routes.hello.href({ name: 'Remix' })` produces `/hello/Remix`.

### Components

Remix UI uses JSX, but it is not React. A component's setup function runs once per instance and returns a render function. Local variables in setup preserve state between renders; event handlers change that state and call `handle.update()` to request another render:

```tsx
import { on } from 'remix/ui'
import type { Handle } from 'remix/ui'

function Counter(handle: Handle) {
  let count = 0

  return () => (
    <button
      type="button"
      mix={on('click', () => {
        count++
        handle.update()
      })}
    >
      Count: {count}
    </button>
  )
}
```

Read changing props from `handle.props` during render, rather than capturing their initial values in setup. Do not apply React hooks or lifecycle assumptions.

Event handlers run only when the component is mounted or hydrated in the browser; server-rendered HTML alone is not interactive. Follow the installed interactivity guide and the app's existing browser-entry setup.

## Work Within the App

- Preserve the app's package manager, scripts, runtime, middleware order, and import conventions unless the task requires changing them. Do not replace an existing solution merely to match the starter.
- Change the narrowest owner of the behavior. Keep route-local code together and share it only when multiple areas need it.
- Prefer Web APIs, native links, buttons, and forms, plus existing first-party Remix primitives, over custom abstractions.
- Treat browser-reachable modules as public: keep secrets and trusted server logic out of them. In the starter, colocated `public/` directories mark browser-reachable source.

## Verify the Behavior

Use the app's scripts for relevant tests and typechecking, then verify the changed behavior directly. For UI changes, exercise the interaction in the browser, not just the rendered appearance. When enhancing a server-rendered page, check both ordinary document behavior and the enhanced path. Test rejection and failure paths for changes involving untrusted input or access control.

Use the installed testing guide for test patterns and CLI documentation for diagnostics. Run `remix doctor` after structural or configuration changes; review findings before applying fixes. Do not run destructive database commands or rewrite configuration merely to make a diagnostic pass. Report what was checked and what remains unverified.
