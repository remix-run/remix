# Hydration

## Defining a client entry

The `clientEntry` ID format is `moduleUrl#ExportName`. If you omit the export name, the function's name is used as a fallback.

## Booting the client

### `run` options

- **`processClientEntryPreloads(preloads)`** (optional) - Processes module preloads discovered in frame responses before they are added to the document. Return the preload URLs that should remain as native `<link rel="modulepreload">` elements.

### Trusted documents and module loading

The initial document and HTML returned by `resolveFrame` are trusted application content. They can
select client-entry modules and contribute import maps, styles, and nested frames. Only return HTML
from sources the application trusts to run code in the current page. The default resolver restricts
requests and redirects to the document origin, but Remix does not sanitize the returned HTML and
same-origin user-generated content is not implicitly safe.

Remix passes each serialized module specifier unchanged to `loadModule`. The loader controls how it
resolves that specifier, so client entries can use CDN URLs, development server URLs, or bare
specifiers resolved through import maps or a custom loader. With `import(moduleUrl)`, relative
specifiers resolve from the module containing that import, subject to the document's import map.
Applications that restrict module sources should enforce that policy in their loader before
importing code. The runtime's check that the returned export is a function happens after loading;
it checks the component shape, not whether the module is trusted.

## What gets serialized

In addition to the serializable values documented publicly, client entry props may contain:

- `<Frame>` elements in props (serialized as frame descriptors)

## How hydration works

1. Props and module metadata are collected into a `<script type="application/json" id="rmx-data">` tag.
2. Once a module loads, the component is hydrated against the existing DOM. Matching elements are adopted in place; mismatches are patched.

This means:

- Client entries inside `data-rmx-preserve-dom` hydrate during initial boot, but future frame reloads will not patch new server-rendered children or props through that preserved host. See [Preserving client-owned DOM](./frames.md#preserving-client-owned-dom).
