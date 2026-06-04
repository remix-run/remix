# node-hmr

Run Node.js applications with Hot Module Reloading.

## Features

- **Drop-in Node.js replacement**: Run an entry file directly with `remix node-hmr server.js` along with supported Node flags
- **HMR Runtime**: Provides an `import.meta.hot` API for modules that can handle hot updates
- **Browser HMR channel:** Serves an endpoint for browser HMR clients and an API for relaying custom events
- **Restart Fallback**: Restarts the child Node process when updates aren't accepted

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

When a module references `import.meta.hot`, `node-hmr` injects a hot context for that module. Use it to tell the runtime which updates can be handled without restarting the process.

```ts
let message = 'Hello'

export function getMessage() {
  return message
}

if (import.meta.hot) {
  import.meta.hot.accept((module) => {
    if (module && typeof module === 'object' && 'message' in module) {
      message = String(module.message)
    }
  })
}
```

If a changed module does not accept the update, and the update cannot be accepted by one of its importers, `node-hmr` restarts the child process.

#### `import.meta.hot.accept()`

Mark the current module as safe to hot update.

```ts
export let greeting = 'Hello'

if (import.meta.hot) {
  import.meta.hot.accept((module) => {
    if (module && typeof module === 'object' && 'greeting' in module) {
      greeting = String(module.greeting)
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
    if (module && typeof module === 'object' && 'message' in module) {
      currentMessage = String(module.message)
    }
  })
}
```

Multiple dependencies can be accepted at once:

```ts
if (import.meta.hot) {
  import.meta.hot.accept(['./one.ts', './two.ts'], ([one, two]) => {
    if (one && typeof one === 'object') {
      // Update state that depends on ./one.ts
    }

    if (two && typeof two === 'object') {
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
    if (!module || typeof module !== 'object' || !('createServer' in module)) {
      import.meta.hot?.invalidate('Updated server module is missing createServer')
      return
    }
  })
}
```

### Browser Event Channel

Browser HMR clients can also connect to the `node-hmr` process.

Import `browserEventChannel` to get access to the `eventUrl` and a `send` function for sending additional HMR events to the browser runtime.

This channel can also be passed directly to `createAssetServer` from `remix/assets`.

```ts
import { createAssetServer } from 'remix/assets'

const isDevelopment = process.env.NODE_ENV === 'development'
const nodeHmr = isDevelopment ? await import('remix/node-hmr') : undefined

export const assetServer = createAssetServer({
  // ...
  hmr: nodeHmr?.browserEventChannel,
  watch: isDevelopment,
})
```

In the browser entry, the bookstore demo listens for server updates and reloads the top frame so the browser can fetch fresh server output after server code changes:

```ts
import { getTopFrame } from 'remix/ui'

if (import.meta.hot) {
  import.meta.hot.on('remix:server-update', async () => {
    await getTopFrame().reload()
  })
}
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
