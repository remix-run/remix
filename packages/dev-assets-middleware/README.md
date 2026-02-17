# dev-assets-middleware

Middleware for transforming assets with `remix/assets` and serving them in development.

This is the development counterpart to `remix/assets-middleware`. While this package transforms source files on-the-fly and serves them from the development server, the production middleware serves built assets from a manifest.

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createRouter } from 'remix/fetch-router'
import { devAssets } from 'remix/dev-assets-middleware'

let router = createRouter({
  middleware: [
    devAssets({
      allow: ['app/**', '**/node_modules/**'],
      files: [
        {
          include: 'app/**/*.{png,jpg,jpeg}',
          variants: {
            original: (buffer) => buffer,
            thumbnail: (buffer) => generateThumbnail(buffer),
          },
          defaultVariant: 'original',
        },
      ],
    }),
  ],
})
```

### Workspace Access

Files outside the app root are served via `/__@workspace/` URLs. Use `workspaceRoot`, along with optional `workspaceAllow` / `workspaceDeny` that replace the top-level `allow` / `deny` patterns.

```ts
devAssets({
  allow: ['app/**', '**/node_modules/**'],
  workspaceRoot: '../..',
  workspaceAllow: ['packages/*/src/**/*', '**/node_modules/**'],
})
```

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API
- [`static-middleware`](https://github.com/remix-run/remix/tree/main/packages/static-middleware) - Middleware for serving static files
- [`assets`](https://github.com/remix-run/remix/tree/main/packages/assets) - Unbundled browser build tooling and development handler
- [`assets-middleware`](https://github.com/remix-run/remix/tree/main/packages/assets-middleware) - Middleware for serving built assets from a manifest

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
