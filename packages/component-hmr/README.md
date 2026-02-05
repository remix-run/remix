# component-hmr

Hot Module Replacement (HMR) for Remix components. Enables components to hot-swap without losing state, both in the browser and on the server.

## Features

- **State preservation** - Component state persists across updates
- **Setup hash tracking** - Detects when setup scope changes and triggers remount
- **Runtime-agnostic** - Core logic works in any JavaScript environment
- **AST-based transforms** - Uses SWC for reliable code transformation

## Installation

```sh
npm install @remix-run/component-hmr
```

## Usage

This package provides two main exports:

### Transform API

Used by build tools and dev servers to transform component source code:

```ts
import { transformComponent } from '@remix-run/component-hmr/transform'

let result = await transformComponent(source, moduleUrl)
// result.code contains the transformed code with HMR wrappers
// result.map contains the source map (optional)
```

### Runtime API

Used by the browser or server to manage component hot-swapping:

```ts
import {
  __hmr_register_component,
  __hmr_get_component,
  __hmr_update,
} from '@remix-run/component-hmr/runtime'
```

## How It Works

### Transform

The transform detects Remix components (functions that return render functions) and wraps them with HMR infrastructure:

**Input:**

```tsx
export function Counter(handle: Handle) {
  let count = 0
  return () => <button onClick={() => count++}>{count}</button>
}
```

**Output:**

```tsx
// Transformed with HMR wrappers
function Counter__impl(handle) {
  let __s = __hmr_state(handle)
  if (
    __hmr_setup(
      handle,
      __s,
      '/Counter.tsx',
      'Counter',
      'h123',
      (__s) => {
        __s.count = 0
      },
      Counter,
    )
  ) {
    return () => null
  }
  __hmr_register(
    '/Counter.tsx',
    'Counter',
    handle,
    () => <button onClick={() => __s.count++}>{__s.count}</button>,
    Counter,
  )
  return () => __hmr_call(handle)
}

__hmr_register_component('/Counter.tsx', 'Counter', Counter__impl)

function Counter(handle) {
  let impl = __hmr_get_component('/Counter.tsx', 'Counter')
  return impl(handle)
}
```

The transform:

1. Hoists setup variables to a stable state object (`__s`)
2. Generates a hash of setup code for change detection
3. Creates a delegating wrapper for hot-swapping implementations

### Runtime

The runtime provides:

- **Component registry** - Maps module URLs to component implementations
- **State management** - Preserves component state across updates
- **Setup tracking** - Detects setup scope changes and triggers remounts
- **Handle tracking** - Manages component lifecycle

When a file changes:

1. The new module is dynamically imported
2. New implementation is registered in the registry
3. All handles are called with the new implementation
4. If setup hash changed, component remounts with fresh state

## Integration

### Client-side (Browser)

Used by `@remix-run/dev-assets-middleware`:

```ts
import { transformComponent } from '@remix-run/component-hmr/transform'

// Transform component files during esbuild
if (isComponentFile) {
  let result = await transformComponent(source, moduleUrl)
  return result.code
}

// Serve the HMR runtime at a known URL
// The runtime imports are injected by the transform
```

### Server-side (Node.js)

Used by `@remix-run/watch`:

```ts
import { transformComponent } from '@remix-run/component-hmr/transform'

// Node.js loader hook transforms components
export async function load(url, context, nextLoad) {
  let source = await readFile(url)
  let result = await transformComponent(source, url)
  return { source: result.code }
}
```

## Limitations

- **Component pattern required** - Only functions that return functions are detected
- **Setup scope only** - Variables must be declared in the setup scope to persist
- **Hash-based change detection** - Formatting changes trigger unnecessary remounts
- **ESM only** - Requires ES modules

## Related Packages

- [`dev-assets-middleware`](../dev-assets-middleware) - Client-side HMR for components
- [`watch`](../watch) - Server-side HMR for components
- [`component`](../component) - Core component library

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
