# script-handler

On-demand client-side JavaScript/TypeScript module compilation for Remix routes.

- Compiles modules at request time
- Rewrites imports to cache-busted URLs
- Supports source maps and workspace modules
- Exposes preload URL generation for HTML rendering

## Quick start

```ts
import { createRouter } from '@remix-run/fetch-router'
import { createScriptHandler } from '@remix-run/script-handler'

let scripts = createScriptHandler({
  entryPoints: ['app/entry.tsx', 'app/worker.ts'],
  root: import.meta.dirname,
  workspaceRoot: '../..',
})

let router = createRouter()

router.get('/scripts/*path', async ({ request, params }) => {
  if (!params.path) return new Response('Not found', { status: 404 })
  let response = await scripts.handle(request, params.path)
  return response ?? new Response('Not found', { status: 404 })
})
```

## HTML preloads

```ts
let preloads = await scripts.preloads('app/entry.tsx')

let links = preloads.map((href) => `<link rel="modulepreload" href="${href}" />`).join('\n')
```

## Behavior

- Entry points (no `?v=` hash) are restricted to configured `entryPoints`
- Internal modules (with `?v=`) are served as immutable
- `GET` and `HEAD` requests are supported
- Returns `null` when a request/path is not handled

## Related packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
