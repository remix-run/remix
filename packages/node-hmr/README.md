# node-hmr

Run Node.js applications with Hot Module Reloading.

## Features

- **HMR Runtime**: Provides an `import.meta.hot` API for modules that can handle hot updates
- **Module Hook Friendly**: Use Node's module customization hooks API to automatically insert `import.meta.hot` usage
- **Restart Fallback**: Restarts the child Node process when updates aren't accepted
- **Fetch Proxy Support**: Wrap fetch handlers so requests are delayed/retried during server updates/restarts
- **Browser HMR Integration**: Optionally hosts browser HMR coordination that survives child restarts

## Installation

```sh
npm i remix
```

## Usage

Create a development script that starts your app server with HMR enabled, along with any additional Node args, such as the `--import` flag to provide [Node module customization hooks](https://nodejs.org/api/module.html#customization-hooks) for [JSX syntax support](https://github.com/remix-run/remix/tree/main/packages/node-tsx) and [Remix component HMR](https://github.com/remix-run/remix/tree/main/packages/ui-hmr):

```ts
// dev.ts
import { run } from 'remix/node-hmr'

run('./server.ts', {
  nodeArgs: ['--import', 'remix/node-tsx', '--import', 'remix/ui-hmr/node'],
  watch: {
    ignore: ['**/node_modules/**'],
  },
})
```

Then run the script with Node:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development node dev.ts"
  }
}
```

## Fetch Proxy Support

During development, server updates can briefly leave your app unable to handle requests. In a server-only context, requests may be rejected while the child server is restarting. In a browser context, the browser may refresh or revalidate at the same time as a server restart, which can result in failed requests or a broken page.

A stable proxy server can avoid this by continuing to listen on the public port while `node-hmr` updates the child server behind it. `createHmrReadyFetch()` works with any fetch handler, so you can compose it with `createFetchProxy()` from [`remix/fetch-proxy`](https://github.com/remix-run/remix/tree/main/packages/fetch-proxy) to forward requests to the child server while delaying or retrying requests during updates.

```ts
// dev.ts
import * as http from 'node:http'

import { createFetchProxy } from 'remix/fetch-proxy'
import { run, createHmrReadyFetch } from 'remix/node-hmr'
import { createRequestListener } from 'remix/node-fetch-server'

const publicPort = 44100
const childPort = 44101

const hmrRunner = run('./server.ts', {
  env: {
    ...process.env,
    PORT: String(childPort),
  },
  nodeArgs: ['--import', 'remix/node-tsx'],
})

const proxyFetch = createFetchProxy(`http://127.0.0.1:${childPort}`, {
  xForwardedHeaders: true,
})

const server = http.createServer(createRequestListener(createHmrReadyFetch(hmrRunner, proxyFetch)))

server.listen(publicPort)
```

By default, `createHmrReadyFetch()` retries `GET` and `HEAD` requests when the wrapped fetch handler throws or returns a `502`, `503`, or `504` response, but only if the server updated or restarted while the request was in flight. You can customize this policy with `shouldRetry`:

```ts
let fetchWhenReady = createHmrReadyFetch(hmrRunner, proxyFetch, {
  shouldRetry({ request, response }) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return false

    return response === undefined || [502, 503, 504].includes(response.status)
  },
})
```

## Browser HMR Integration

`node-hmr` can coordinate browser-facing HMR alongside server HMR. The parent process hosts the browser event stream, tracks files reported by asset servers in the child process, sends matching file events back to the child runtime, and emits the resulting browser updates to connected clients.

This is co-ordinated through the use of a browser HMR channel which can be created within the app server when running in `node-hmr` via the `remix/node-hmr/runtime` import:

```ts
import { createBrowserHmrChannel } from 'remix/node-hmr/runtime'

let browserHmrChannel = await createBrowserHmrChannel()
```

The `remix/node-hmr/runtime` API is only available inside a child process supervised by `node-hmr`. Importing it outside `node-hmr` throws. When code may also run outside `node-hmr`, you can check `process.env.NODE_HMR` before dynamically importing the runtime API:

```ts
if (process.env.NODE_HMR) {
  let { createBrowserHmrChannel } = await import('remix/node-hmr/runtime')
  let browserHmrChannel = await createBrowserHmrChannel()
}
```

A browser HMR channel is scoped to the current child process. It gives browser HMR tooling an EventSource URL, a way to report the files it wants watched, and a way to respond to file changes with browser HMR events.

Browser asset servers can use this API to co-ordinate browser HMR with the server, for example, [`remix/assets`](https://github.com/remix-run/remix/tree/main/packages/assets) via its `hmr` option to `createAssetServer`:

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  hmr: process.env.NODE_HMR
    ? async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel()
    : undefined,
  watch: true,
})
```

When `node-hmr` hot updates or restarts server code in a way that should refresh server-rendered UI, it sends a `server:update` event to connected clients.

Call `emitServerReady()` when your app server is ready to receive requests. This lets the parent process delay browser `server:update` events until a restarted app server has finished listening:

```ts
server.listen(port, () => {
  if (process.env.NODE_HMR) {
    import('remix/node-hmr/runtime').then((nodeHmr) => nodeHmr.emitServerReady())
  }
})
```

## File Watching

The file system is watched automatically so server source changes can hot update or restart the child process.

You can optionally provide an array of glob patterns to the `watch.ignore` option.

```ts
import { run } from 'remix/node-hmr'

run('./server.ts', {
  nodeArgs: ['--import', 'remix/node-tsx', '--import', 'remix/ui-hmr/node'],
  watch: {
    ignore: ['**/node_modules/**'],
  },
})
```

You can also configure polling behavior. Polling defaults to `true` on Windows and `false` elsewhere:

```ts
import { run } from 'remix/node-hmr'

run('./server.ts', {
  nodeArgs: ['--import', 'remix/node-tsx', '--import', 'remix/ui-hmr/node'],
  watch: {
    poll: true,
    pollInterval: 100,
  },
})
```

## `import.meta.hot`

The `import.meta.hot` API provided by `node-hmr` is a small runtime contract for modules that can handle updates without restarting the process. It is primarily intended for transforms like [remix/ui-hmr](https://github.com/remix-run/remix/tree/main/packages/ui-hmr), but it can also be used directly.

To type `import.meta.hot`, add the HMR types to your TypeScript config:

```json
{
  "compilerOptions": {
    "types": ["remix/node-hmr/types"]
  }
}
```

HMR accept calls are statically analyzed. Write them directly as `import.meta.hot.accept(...)`. Dependency accepts must use string literals or arrays of string literals; do not alias `import.meta.hot` or pass dynamically constructed dependency lists.

```ts
if (import.meta.hot) {
  import.meta.hot.accept()
}
```

For consistency with browser HMR environments, `node-hmr` also implements `import.meta.hot.on(...)`, but no events are fired in server modules.

### Accepting updates

Calling `accept()` makes the current module an HMR boundary. When the module changes, `node-hmr` evaluates the updated module and calls your callback with its exports.

```ts
export let value = 1

if (import.meta.hot) {
  import.meta.hot.accept((module) => {
    if (typeof module.value !== 'number') {
      import.meta.hot?.invalidate('Updated module no longer exports value')
      return
    }

    value = module.value
  })
}
```

You can also accept updates from direct dependencies.

```ts
import { value } from './value.ts'

let currentValue = value

export function readValue() {
  return currentValue
}

if (import.meta.hot) {
  import.meta.hot.accept('./value.ts', (module) => {
    if (typeof module.value !== 'number') {
      import.meta.hot?.invalidate('Updated dependency no longer exports value')
      return
    }

    currentValue = module.value
  })
}
```

Multiple dependencies can be accepted at once. The callback receives an array where only the changed dependency is defined.

```ts
if (import.meta.hot) {
  import.meta.hot.accept(['./one.ts', './two.ts'], ([oneModule, twoModule]) => {
    // oneModule is defined when ./one.ts changed.
    // twoModule is defined when ./two.ts changed.
  })
}
```

### Cleaning up

Register cleanup that should run before the module is replaced or disposed.

```ts
let interval = setInterval(refreshCache, 30_000)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearInterval(interval)
  })
}
```

The `data` object is preserved across updates for the same module. Use it for small pieces of state.

```ts
let count = Number(import.meta.hot?.data.count ?? 0)

export function increment() {
  count++
}

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.count = count
  })
}
```

### Invalidating updates

Call `invalidate()` inside an accept callback when the update cannot be applied safely. `node-hmr` falls back to a process restart.

```ts
if (import.meta.hot) {
  import.meta.hot.accept((module) => {
    if (typeof module.value !== 'number') {
      import.meta.hot?.invalidate('Updated module no longer exports value')
      return
    }
  })
}
```

## Related Packages

- [`assets`](https://github.com/remix-run/remix/tree/main/packages/assets) - Consumes browser HMR channels for coordinating server and browser HMR updates
- [`fetch-proxy`](https://github.com/remix-run/remix/tree/main/packages/fetch-proxy) - Creates fetch handlers for forwarding requests to another server
- [`ui-hmr`](https://github.com/remix-run/remix/tree/main/packages/ui-hmr) - Provides code transforms and runtime for HMR for Remix UI components

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
