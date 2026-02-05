# watch

File watcher with Hot Module Replacement (HMR) for Remix components on the server. Component changes are hot-swapped without restarting the server or losing in-memory state.

## Features

- **Server-side component HMR** - Components hot-swap without losing server state
- **Selective restarts** - Non-component changes trigger clean restarts
- **Convention-based** - Works out of the box, configure if needed
- **Zero application changes** - HMR is injected automatically via Node.js loader
- **Development tooling** - Runs on Node.js in development, deploy anywhere in production

## Installation

```sh
npm install --save-dev @remix-run/watch
```

## Usage

```sh
remix-watch server.ts
```

HMR runs for modules that only export components, while other file changes trigger a server restart. No configuration needed.

### CLI options

- **`--ignore <pattern>`** – Exclude files from watching (can be repeated)
- **`--watch <path>`** – Also watch these files (e.g. config loaded via `fs.readFile`)

```sh
remix-watch server.ts --ignore "**/test/**" --watch config.json
```

## Related Packages

- [`component-hmr`](../component-hmr) - Core HMR transform and runtime for Remix components
- [`dev-assets-middleware`](../dev-assets-middleware) - Development middleware for client assets with HMR
- [`component`](../component) - Remix component primitives

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
