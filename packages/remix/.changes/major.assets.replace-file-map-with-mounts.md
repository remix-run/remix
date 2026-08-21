BREAKING CHANGE: In `createAssetServer()` from `remix/assets`, replace the `fileMap` option with optional directory-based `mounts`. Mounts recursively preserve the path beneath each public and filesystem root, keeping module URLs aligned with the filesystem hierarchy used for package resolution.

When `mounts` is omitted, the asset server uses `{ app: 'app', npm: 'node_modules' }`.

To migrate an app whose `fileMap` is equivalent to the new defaults, remove the `fileMap` option entirely:

```ts
// before
createAssetServer({
  basePath: '/assets',
  fileMap: {
    '/app/*path': 'app/*path',
    '/npm/*path': 'node_modules/*path',
  },
  // ...
})

// after
createAssetServer({
  basePath: '/assets',
  // ...
})
```

To migrate custom `fileMap` rules that preserve directory hierarchy, remove the trailing wildcard from both sides and rename `fileMap` to `mounts`:

```ts
// before
createAssetServer({
  basePath: '/assets',
  fileMap: {
    '/source/*path': 'app/*path',
    '/vendor/*path': 'node_modules/*path',
  },
  // ...
})

// after
createAssetServer({
  basePath: '/assets',
  mounts: {
    source: 'app',
    vendor: 'node_modules',
  },
  // ...
})
```
