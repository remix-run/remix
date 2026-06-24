# node-hmr

Run Node.js applications with Hot Module Reloading.

## Features

- **HMR Runtime**: Provides an `import.meta.hot` API for modules that can handle hot updates
- **Module Hook Friendly**: Works with Node import hooks that generate `import.meta.hot` usage
- **Restart Fallback**: Restarts the child Node process when updates aren't accepted
- **Browser HMR Integration**: Optionally hosts browser HMR coordination that survives child restarts

## Installation

```sh
npm i remix
```

## Usage

Create a development script that starts your app server with HMR enabled, along with any additional Node args:

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

## Module Hooks

`node-hmr` provides the `import.meta.hot` runtime and watches the loaded module graph. It does not transform component modules by itself.

Use Node's `--import` flag to add transforms with [Node's module customization hooks API](https://nodejs.org/api/module.html#customization-hooks), such as Remix UI component HMR:

```sh
node --import remix/node-tsx --import remix/ui-hmr/node ./server.ts
```

## Browser HMR Integration

`node-hmr` can coordinate browser-facing HMR alongside server HMR. The parent process hosts the browser event stream, tracks files reported by asset servers in the child process, sends matching file events back to the child runtime, and emits the resulting browser updates to connected clients.

This is co-ordinated through the use of a browser HMR channel which can be created within the app server when running in `node-hmr` via the `remix/node-hmr/runtime` import:

```ts
import { createBrowserHmrChannel } from 'remix/node-hmr/runtime'

let browserHmrChannel = await createBrowserHmrChannel()
```

A browser HMR channel is scoped to the current child process. It gives browser HMR tooling an EventSource URL, a way to report the files it wants watched, and a way to respond to file changes with browser HMR events.

Browser asset servers can use this API to co-ordinate browser HMR with the server, for example, [`remix/assets`](https://github.com/remix-run/remix/tree/main/packages/assets) via its `hmr` option to `createAssetServer`:

```ts
import { createAssetServer } from 'remix/assets'
import { createBrowserHmrChannel } from 'remix/node-hmr/runtime'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  hmr: createBrowserHmrChannel,
  watch: true,
})
```

When `node-hmr` hot updates or restarts server code in a way that should refresh server-rendered UI, it sends a `server:update` event to connected clients.

Call `emitServerReady()` when your app server is ready to receive requests. This lets the parent process delay browser `server:update` events until a restarted app server has finished listening:

```ts
server.listen(port, () => {
  if (isDevelopment) {
    import('remix/node-hmr/runtime').then((nodeHmr) => nodeHmr.emitServerReady())
  }
})
```

## `import.meta.hot`

The `import.meta.hot` API provided by `node-hmr` is primarily intended as a target for code transformations like [remix/ui-hmr](https://github.com/remix-run/remix/tree/main/packages/ui-hmr).

To type `import.meta.hot`, add the HMR types to your TypeScript config:

```json
{
  "compilerOptions": {
    "types": ["remix/node-hmr/types"]
  }
}
```

### `import.meta.hot.accept()`

Mark the current module as safe to hot update. Calling `accept()` makes the module an HMR boundary, so updates do not continue propagating to importers.

Without a callback, the updated module is still evaluated, but the previous module instance does not copy values from it. Use this when re-running the module's top-level code applies the update.

```ts
let dispose = start()

function start() {
  let timer = setInterval(() => {
    console.log('tick')
  }, 1_000)

  return () => {
    clearInterval(timer)
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    dispose()
  })

  import.meta.hot.accept()
}
```

You can pass a callback to receive the updated module. This is useful when the previous module instance owns long-lived state and needs to copy values from the updated module. Export values that need to be copied as `let` bindings.

```ts
export let greeting = 'Hello'

export function getGreeting() {
  return greeting
}

if (import.meta.hot) {
  import.meta.hot.accept((module) => {
    if (typeof module.greeting === 'string') {
      greeting = module.greeting
    }
  })
}
```

You can also accept updates from a dependency. This is useful when a module owns long-lived state but imports small values or helpers that can be replaced in place.

```ts
import { message } from './message.ts'

let currentMessage = message

export function render() {
  return currentMessage
}

if (import.meta.hot) {
  import.meta.hot.accept('./message.ts', (module) => {
    if (typeof module.message === 'string') {
      currentMessage = module.message
    }
  })
}
```

Multiple dependencies can be accepted at once:

```ts
import { one } from './one.ts'
import { two } from './two.ts'

let values = { one, two }

export function render() {
  return `${values.one} ${values.two}`
}

if (import.meta.hot) {
  import.meta.hot.accept(['./one.ts', './two.ts'], ([oneModule, twoModule]) => {
    if (oneModule && typeof oneModule.one === 'string') {
      values.one = oneModule.one
    }

    if (twoModule && typeof twoModule.two === 'string') {
      values.two = twoModule.two
    }
  })
}
```

### `import.meta.hot.dispose()`

Register cleanup that should run before the module is replaced or the child process exits.

```ts
let timer = setInterval(() => {
  console.log('tick')
}, 1_000)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearInterval(timer)
  })
}
```

The `data` object is preserved across updates for the same module, which lets a replacement module recover small pieces of state.

```ts
let count = Number(import.meta.hot?.data.count ?? 0)

export function increment() {
  count++
  return count
}

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.count = count
  })
}
```

### `import.meta.hot.invalidate()`

Call `invalidate()` when a module accepts an update but discovers that it cannot apply it safely. This asks `node-hmr` to fall back to a process restart.

```ts
if (import.meta.hot) {
  import.meta.hot.accept((module) => {
    if (typeof module.createServer !== 'function') {
      import.meta.hot?.invalidate('Updated server module is missing createServer')
      return
    }
  })
}
```

## Related Packages

- [`assets`](https://github.com/remix-run/remix/tree/main/packages/assets) - Consumes browser HMR channels for coordinating server and browser HMR updates
- [`ui-hmr`](https://github.com/remix-run/remix/tree/main/packages/ui-hmr) - Provides code transforms and runtime for HMR for Remix UI components

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
