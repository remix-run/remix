Add `resolveHeadContent()` for rendering head markup from client entry data during SSR.

`renderToStream()` now accepts `resolveHeadContent({ clientEntryIds, clientEntryHrefs })` which returns `Promise<string>` so you can return additional `<head>` HTML content for client entries during server rendering.
