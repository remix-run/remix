BREAKING CHANGE: `createAssetServer()` now requires a `basePath` option, and `fileMap` URL patterns are now relative to that base path.

```ts
// Before:
createAssetServer({
  fileMap: {
    '/assets/app/*path': 'app/*path',
    '/assets/npm/*path': 'node_modules/*path',
  },
  allow: ['app/**', 'node_modules/**'],
})

// After:
createAssetServer({
  basePath: '/assets',
  fileMap: {
    '/app/*path': 'app/*path',
    '/npm/*path': 'node_modules/*path',
  },
  allow: ['app/**', 'node_modules/**'],
})
```
