# `file-storage` CHANGELOG

This is the changelog for [`file-storage`](https://github.com/mjackson/remix-the-web/tree/main/packages/file-storage). It follows [semantic versioning](https://semver.org/).

## v0.7.0 (2025-06-10)

- Add `/src` to npm package, so "go to definition" goes to the actual source
- Use one set of types for all built files, instead of separate types for ESM and CJS
- Build using esbuild directly instead of tsup

## v0.6.1 (2025-02-06)

- Fix regression when using `LocalFileStorage` together with `form-data-parser` (see #53)

## v0.6.0 (2025-02-04)

- BREAKING CHANGE: `LocalFileStorage` now uses 2 characters for shard directory names instead of 8.
- Buffer contents of files stored in `MemoryFileStorage`.
- Add `storage.list(options)` for listing files in storage.

The following `options` are available:

- `cursor`: An opaque string that allows you to paginate over the keys in storage
- `includeMetadata`: If `true`, include file metadata in the result
- `limit`: The maximum number of files to return
- `prefix`: Only return keys that start with this string

For example, to list all files under keys that start with `user123/`:

```ts
let result = await storage.list({ prefix: 'user123/' });
console.log(result.files);
// [
//   { key: "user123/..." },
//   { key: "user123/..." },
//   ...
// ]
```

`result.files` will be an array of `{ key: string }` objects. To include metadata about each file, use `includeMetadata: true`.

```ts
let result = await storage.list({ prefix: 'user123/', includeMetadata: true });
console.log(result.files);
// [
//   {
//     key: "user123/...",
//     lastModified: 1737955705270,
//     name: "hello.txt",
//     size: 16,
//     type: "text/plain"
//   },
//   ...
// ]
```

Pagination is done via an opaque `cursor` property in the list result object. If it is not `undefined`, there are more files to list. You can list them by passing the `cursor` back in the `options` object on the next call. For example, to list all items in storage, you could do something like this:

```ts
let result = await storage.list();
console.log(result.files);

while (result.cursor !== undefined) {
  result = await storage.list({ cursor: result.cursor });
  console.log(result.files);
}
```

Use the `limit` option to limit how many results you get back in the `files` array.

## v0.5.0 (2025-01-25)

- Add `storage.put(key, file)` method as a convenience around `storage.set(key, file)` + `storage.get(key)`, which is a very common pattern when you need immediate access to the file you just put in storage

```ts
// before
await storage.set(key, file);
let newFile = await storage.get(key)!;

// after
let newFile = await storage.put(key, file);
```

## v0.4.1 (2025-01-10)

- Fix missing types for `file-storage/local` in npm package

## v0.4.0 (2025-01-08)

- Fixes race conditions with concurrent calls to `set`
- Shards storage directories for more scalable file systems

## v0.3.0 (2024-11-14)

- Added CommonJS build
- Upgrade to lazy-file@3.1.0

## v0.2.1 (2024-09-04)

- Automatically clean up old files in `LocalFileStorage` when new files are stored with the same key

## v0.2.0 (2024-08-26)

- Moved `LocalFileStorage` to `file-storage/local` export
- Moved `MemoryFileStorage` to `file-storage/memory` export

## v0.1.0 (2024-08-24)

- Initial release
