# node-hmr

Run Node.js applications in development with TypeScript syntax support, file watching, restart fallback, and a small `import.meta.hot` runtime.

## Features

- **Node-like CLI**: Run an entry file directly with `remix-node-hmr server.ts`
- **TypeScript Syntax Support**: Uses `@remix-run/node-tsx` internally so `.ts`, `.tsx`, `.js`, and `.jsx` entry files work in development
- **Restart Fallback**: Restarts the application process when watched files change
- **HMR Runtime**: Provides the initial `import.meta.hot` runtime contract for modules that want to prepare for hot updates

## Installation

```sh
npm i remix
```

## Usage

Use `remix-node-hmr` in development where you would otherwise use a TypeScript-aware Node runner:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development remix-node-hmr server.ts"
  }
}
```

Modules can register cleanup and future hot-update behavior with `import.meta.hot`:

```ts
if (import.meta.hot) {
  import.meta.hot.accept()
  import.meta.hot.dispose((data) => {
    data.updatedAt = Date.now()
  })
}
```

The first implementation always keeps process restart as the safe fallback. Accepted in-process server updates can be layered behind the same runtime contract over time.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
