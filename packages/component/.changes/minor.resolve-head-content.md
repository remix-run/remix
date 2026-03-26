Add `resolveClientEntryLinks()` for rendering client-entry link tags during SSR.

`renderToStream()` now accepts `resolveClientEntryLinks({ clientEntryIds, clientEntryHrefs })` which returns `Promise<LinkDescriptor[]>`
