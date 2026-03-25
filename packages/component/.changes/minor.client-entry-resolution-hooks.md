Allow `clientEntry()` to preserve opaque client entry IDs for server-side resolution.

`renderToStream()` now accepts `resolveClientEntry(entryId, component)` which returns `Promise<{ href, exportName }>` so you can map custom entry IDs to runtime module URLs during server rendering.
