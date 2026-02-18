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
import { createDevAssets } from 'remix/dev-assets-middleware'

let devAssets = createDevAssets({
  allow: ['app/**', '**/node_modules/**'],
  files: [
    {
      include: 'app/**/*.{png,jpg,jpeg}',
      variants: {
        original: (buffer) => buffer,
        thumbnail: async (buffer) => {
          let { generateThumbnail } = await import('./generate-thumbnail.ts')
          return await generateThumbnail(buffer)
        },
      },
      defaultVariant: 'original',
    },
  ],
})

let router = createRouter({
  middleware: [devAssets.middleware],
})

router.get('/', ({ assets }) => {
  let entry = assets.resolve('app/entry.tsx')
  entry?.href // '/app/entry.tsx'
  entry?.preloads // ['/app/entry.tsx']

  let thumbnail = assets.resolve('app/images/logo.png', 'thumbnail')
  thumbnail?.href // '/__@files/app/images/logo.png?@thumbnail'
})

// On server shutdown, stop the file watcher
devAssets.close()
```

### Workspace Access

To serve files from outside the project root, you can configure the `workspaceRoot` option, along with optional `workspaceAllow` and `workspaceDeny` patterns that replace the top-level `allow` and `deny` patterns.

```ts
createDevAssets({
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
