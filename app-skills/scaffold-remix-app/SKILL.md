---
name: scaffold-remix-app
description: Use when you are in a newly created project directory and want to scaffold the initial structure for a Remix app you can build features on top of.
---

# Scaffold a Remix App (Node.js)

Use this skill when you are in a newly created directory and need to scaffold a basic Remix app that runs on Node.js.

## File Structure

```text
.
├── package.json
├── server.ts
├── routes.ts
├── router.ts
├── lib/
│   ├── render.ts
│   └── <shared>.ts
└── app/
    ├── root/
    │   ├── controller.tsx
    │   ├── controller.test.ts
    │   ├── Layout.tsx
    │   └── HomePage.tsx
    └── <feature>/
        ├── controller.tsx
        ├── controller.test.ts
        └── <component>.tsx
```

## Workflow

1. Create the project subdirectories.

```sh
mkdir -p lib app/root
```

2. Create `package.json` with a test script.

```json
{
  "scripts": {
    "test": "tsx --test \"./app/**/*.test.ts\"",
    "start": "tsx server.ts"
  }
}
```

3. Install dependencies.

```sh
npm i remix@3.0.0-alpha.3
npm i -D tsx
```

4. Use JSX with Remix components.

Make sure your `tsconfig.json` enables JSX for `remix/component`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "remix/component"
  }
}
```

Components in `remix/component` are not React components. They follow the Remix component model, where a component function returns a render function.

5. Create `routes.ts`.

```ts
import { route } from 'remix/fetch-router/routes'

export let routes = route({
  root: {
    home: '/',
  },
})
```

6. Create `lib/render.ts`.

```ts
import type { RemixNode } from 'remix/component'
import { renderToStream } from 'remix/component/server'
import { createHtmlResponse } from 'remix/response/html'

export function render(node: RemixNode, init?: ResponseInit): Response {
  return createHtmlResponse(renderToStream(node), init)
}
```

7. Create `app/root/Layout.tsx`.

```tsx
import type { RemixNode } from 'remix/component'

type LayoutProps = {
  children?: RemixNode
}

export function Layout() {
  return ({ children }: LayoutProps) => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
```

8. Create `app/root/HomePage.tsx`.

```tsx
export function HomePage() {
  return () => (
    <>
      <h1>My Remix App</h1>
      <p>Server is running.</p>
    </>
  )
}
```

9. Create `app/root/controller.tsx`.

```tsx
import type { Controller } from 'remix/fetch-router'

import { routes } from '../../routes.ts'
import { render } from '../../lib/render.ts'
import { Layout } from './Layout.tsx'
import { HomePage } from './HomePage.tsx'

export default {
  middleware: [],
  actions: {
    home() {
      return render(
        <Layout>
          <title>My Remix App</title>
          <HomePage />
        </Layout>,
      )
    },
  },
} satisfies Controller<typeof routes.root>
```

10. Create `router.ts`.

```ts
import { createRouter } from 'remix/fetch-router'

import rootController from './app/root/controller.tsx'
import { routes } from './routes.ts'

export let router = createRouter()

router.map(routes.root, rootController)
```

11. Create `app/root/controller.test.ts`.

```ts
import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from '../../router.ts'

describe('root controller', () => {
  it('serves the home page through router.fetch', async () => {
    let response = await router.fetch('http://example.com/')
    assert.equal(response.status, 200)

    let contentType = response.headers.get('content-type') ?? ''
    assert.match(contentType, /^text\/html/)

    let body = await response.text()
    assert.match(body, /<h1>My Remix App<\/h1>/)
  })
})
```

12. Create `server.ts`.

```ts
import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { router } from './router.ts'

let server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)

let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 44100

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

13. Run the test.

```sh
npm test
```

14. Run the app.

```sh
npm run start
```

Visit:

- `http://localhost:44100/`

## Checklist

- [ ] `package.json` has `remix` in `dependencies`
- [ ] `package.json` has `tsx` in `devDependencies`
- [ ] `package.json` has a `test` script that runs `./app/**/*.test.ts` via `tsx`
- [ ] `package.json` has a `start` script that runs `tsx server.ts`
- [ ] `routes.ts` and `router.ts` are in the project root
- [ ] `app/root/` contains `controller.tsx`, `controller.test.ts`, `Layout.tsx`, and `HomePage.tsx`
- [ ] `router.ts` maps root route definitions to feature controllers
- [ ] `server.ts` uses `createRequestListener(...)` and `router.fetch(...)`
- [ ] Server handles `SIGINT` and `SIGTERM` for clean shutdown
