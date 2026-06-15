# node-hmr

Run Node.js applications with Hot Module Reloading.

## Features

- **HMR Runtime**: Provides an `import.meta.hot` API for modules that can handle hot updates
- **Restart Fallback**: Restarts the child Node process when updates aren't accepted
- **Browser HMR Integration**: Optionally hosts a browser HMR event channel that survives child restarts

## Installation

```sh
npm i remix
```

## Usage

Create a development script that starts your app server with HMR enabled:

```ts
import { run } from 'remix/node-hmr'

run('./server.ts', {
  nodeArgs: ['--import', 'remix/node-tsx'],
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

## Browser HMR Integration

If your app needs browser HMR coordination, enable a browser event channel in the parent process:

```ts
import { run } from 'remix/node-hmr'

run('./server.ts', {
  nodeArgs: ['--import', 'remix/node-tsx'],
  browserEventChannel: true,
})
```

The browser event channel is hosted by the parent process, so it stays online when the child app
server restarts.

When `node-hmr` hot updates or restarts the server, it sends a `server:update` event to connected
clients through the browser event channel:

```ts
type ServerUpdateEvent = {
  type: 'server:update'
}
```

Access to the browser event channel is available in the `node-hmr` runtime via the `remix/node-hmr/runtime` import:

```ts
import { browserEventChanel } from 'remix/node-hmr/runtime'
```

The `browserEventChannel` object provides a `url` for the EventSource URL, and a `send(payload)` function for sending custom events through the same endpoint.

This browser event channel is supported by the - [`remix/assets`](https://github.com/remix-run/remix/tree/main/packages/assets) package, supporting built-in co-ordination between server and browser code updates.

## Lifecycle

`run()` creates a long-lived parent process supervisor:

1. The parent starts a file watcher and optionally hosts the browser event channel.
2. The parent spawns your app server as a child process.
3. The child process is started with Remix's internal HMR register hook and your explicit `nodeArgs`.
4. The register hook installs `import.meta.hot`, reports the module graph to the parent, and proxies browser HMR payloads back to the parent over IPC.
5. When a watched file changes, the parent either sends a hot update to the child or restarts it.
6. If a browser event channel is enabled, connected browser clients stay connected to the parent while the child restarts.

`run()` starts the HMR runner immediately. Most dev scripts can ignore the returned runner, but a
larger development process can use it to close the runner itself:

```ts
let runner = run('./server.ts')

await runner.close() // stops the watcher, child process, and browser event channel
```

## `import.meta.hot`

When a module references `import.meta.hot`, `node-hmr` injects a hot context for that module. Use
it to tell the runtime which updates can be handled without restarting the process.

```ts
let message = 'Hello'

export function getMessage() {
  return message
}

if (import.meta.hot) {
  import.meta.hot.accept((module) => {
    if (typeof module.message === 'string') {
      message = module.message
    }
  })
}
```

If a changed module does not accept the update, and the update cannot be accepted by one of its
importers, `node-hmr` restarts the child process.

### `import.meta.hot.accept()`

Mark the current module as safe to hot update.

```ts
export let greeting = 'Hello'

if (import.meta.hot) {
  import.meta.hot.accept()
}
```

You can also accept updates from a dependency. This is useful when a module owns long-lived state
but imports small values or helpers that can be replaced in place.

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
if (import.meta.hot) {
  import.meta.hot.accept(['./one.ts', './two.ts'])
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

The `data` object is preserved across updates for the same module, which lets a replacement module
recover small pieces of state.

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

Call `invalidate()` when a module accepts an update but discovers that it cannot apply it safely.
This asks `node-hmr` to fall back to a process restart.

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

- [`remix/assets`](https://github.com/remix-run/remix/tree/main/packages/assets) supports the
  browser event channel for coordinating server and browser HMR updates.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
