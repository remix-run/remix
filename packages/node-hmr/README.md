# node-hmr

Run Node.js applications with Hot Module Reloading.

## Features

- **Drop-in Node.js replacement**: Run an entry file directly with `remix node-hmr server.js` along with supported Node flags
- **HMR Runtime**: Provides an `import.meta.hot` API for modules that can handle hot updates
- **Restart Fallback**: Restarts the child Node process when updates aren't accepted
- **Browser HMR Integration:** Exposes high-level server HMR events to the client

## Installation

```sh
npm i remix
```

## Usage

Use `remix node-hmr` in development where you would otherwise use `node` with a file watcher. Node flags are supported, which means you can also enable TSX support via `remix/node-tsx` with the `--import` flag:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development remix node-hmr --import remix/node-tsx server.ts"
  }
}
```

> If installing the `@remix-run/node-hmr` package directly rather than via `remix`, you should run the `node-hmr` command rather than `remix node-hmr`.

### `import.meta.hot`

An `import.meta.hot` API is provided for managing hot updates.

#### `import.meta.hot.accept()`

Mark the current module as safe to hot update.

```ts
export let greeting = 'Hello'

if (import.meta.hot) {
  import.meta.hot.accept((module) => {
    if (typeof module.greeting === 'string') {
      greeting = String(module.greeting)
    }
  })
}
```

You can also accept updates from a dependency. This is useful when a module owns long-lived state that has imports which be replaced in place.

```ts
import { message } from './message.ts'

let currentMessage = message

export function render() {
  return currentMessage
}

if (import.meta.hot) {
  import.meta.hot.accept('./message.ts', (module) => {
    if (typeof module.message === 'string') {
      currentMessage = String(module.message)
    }
  })
}
```

Multiple dependencies can be accepted at once:

```ts
if (import.meta.hot) {
  import.meta.hot.accept(['./one.ts', './two.ts'], ([one, two]) => {
    if (typeof one.value === 'string') {
      // Update state that depends on ./one.ts
    }

    if (typeof two.value === 'string') {
      // Update state that depends on ./two.ts
    }
  })
}
```

#### `import.meta.hot.dispose()`

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

#### `import.meta.hot.invalidate()`

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

### Browser HMR Integration

To support co-ordination between server and browser HMR, the `node-hmr` runtime provides an `eventChannel` export. This exposes a `url` for an [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) and a `send` function for sending additional events through the same endpoint.

When `node-hmr` hot updates or restarts the server, it sends a `server:update` event to connected clients:

```ts
type ServerUpdateEvent = {
  type: 'server:update'
}
```

This allows for easy integration with `remix/assets` via its `hmr` option. This allows browser HMR events to be sent through the same channel and ensures that the HMR endpoint used by your server code survives server restarts.

```ts
import { createAssetServer } from 'remix/assets'

const isDevelopment = process.env.NODE_ENV === 'development'
export const assetServer = createAssetServer({
  // ...
  hmr: isDevelopment ? await import('remix/node-hmr/runtime') : undefined,
  watch: isDevelopment,
})
```

Browser modules in `remix/assets` can then use the `import.meta.hot` API to respond to server updates and reload the app.

```ts
import { run } from 'remix/ui'

let app = run({
  // ...
})

if (import.meta.hot) {
  import.meta.hot.on('server:update', async () => {
    await app.ready()
    await app.frames.top.reload()
  })
}
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
