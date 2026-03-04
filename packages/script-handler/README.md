# script-handler

On-demand client-side JavaScript/TypeScript module compilation for Remix routes.

- Compiles modules at request time — no build step required
- Content-addressed URLs (`utils.ts.@abc123`) with `Cache-Control: immutable` for internal modules
- Entry points served with `Cache-Control: no-cache` + ETags
- Circular dependencies handled correctly via Tarjan's SCC algorithm
- Supports source maps and workspace monorepo packages
- Preload URL generation for `<link rel="modulepreload">` tags

## Quick start

```ts
import { createRouter } from '@remix-run/fetch-router'
import { createScriptHandler } from '@remix-run/script-handler'

let scripts = createScriptHandler({
  entryPoints: ['app/entry.tsx', 'app/worker.ts'],
  root: import.meta.dirname,
  workspaceRoot: '../..',
  base: '/scripts',
})

let router = createRouter()

router.get('/scripts/*path', async ({ request, params }) => {
  if (!params.path) return new Response('Not found', { status: 404 })
  let response = await scripts.handle(request, params.path)
  return response ?? new Response('Not found', { status: 404 })
})
```

## HTML preloads

Call `preloads()` when rendering HTML to get all transitive dependency URLs for a given entry point. Pass them as `<link rel="modulepreload">` tags so the browser can fetch them in parallel before it even parses the entry point module.

```ts
let preloads = await scripts.preloads('app/entry.tsx')

let links = preloads.map((href) => `<link rel="modulepreload" href="${href}" />`).join('\n')
```

## Caching model

|                   | Entry points                | Internal modules                      |
| ----------------- | --------------------------- | ------------------------------------- |
| **URL**           | `app/entry.tsx` (no suffix) | `utils.ts.@abc123` (content hash)     |
| **Cache-Control** | `no-cache`                  | `public, max-age=31536000, immutable` |
| **ETag**          | compiled output hash        | —                                     |

Internal module URLs are content-addressed: the hash of each module's compiled output transitively incorporates the hashes of all its dependencies. Any change anywhere in the subtree produces a new URL, automatically invalidating all cached ancestors.

Circular dependencies are handled via [Tarjan's SCC algorithm](https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm): all modules in a cycle share a single deterministic hash computed from their combined source texts and the hashes of their external dependencies. If any module in the cycle changes (or any of its deps change), the shared hash changes, invalidating the whole cycle and all importers.

## Behavior

- Entry points (no `.@` suffix) are restricted to configured `entryPoints` patterns
- All other modules require a valid `.@hash` suffix — requests with a wrong or missing hash return 404
- On a page reload, the entry point (served `no-cache`) is revalidated; new hashes cascade to changed deps; unchanged deps are served instantly from browser cache
- `GET` and `HEAD` requests are supported
- Returns `null` when a request/path is not handled (lets the router fall through to a 404)

## Related packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
