BREAKING CHANGE: Browser scripts served by `remix/assets` now keep JavaScript imports as authored and use import maps for resolution. Apps must render each script entry's import map before its modulepreload links and module script. Import maps for hydrated client entries are installed before those entries are loaded.

To migrate an app created from the Remix app template:

1. In `app/assets.ts`, replace the separate entry href and preload calls with `getScriptEntry()`:

```diff
 const entry = 'app/actions/public/entry.ts'
-export const entryHref = await assets.getHref(entry)
-export const entryPreloads = await assets.getPreloads(entry)
+export const scriptEntry = await assets.getScriptEntry(entry)
```

HMR appends mappings for updated modules to the document in additional `<script type="importmap">` elements. When HMR must support browsers without native support for multiple import maps, configure `remix/multiple-import-maps-polyfill` as its module importer:

```diff
 export const assets = createAssetServer({
   // ...
   hmr: isHmr
-    ? async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel()
+    ? {
+        channel: async () =>
+          (await import('remix/node-hmr/runtime')).createBrowserHmrChannel(),
+        moduleImporter: 'remix/multiple-import-maps-polyfill',
+      }
     : undefined,
   scripts: { loaders: isHmr ? [uiHmr()] : undefined },
 })
```

2. In `app/actions/document.tsx`, render the managed import map before the entry's preloads and module script:

```diff
 import type { Handle, RemixNode } from 'remix/ui'
 import { css } from 'remix/ui'
+import { ImportMap } from 'remix/ui/server'

-import { entryHref, entryPreloads } from '../assets.ts'
+import { scriptEntry } from '../assets.ts'

 export function Document(handle: Handle<DocumentProps>) {
   return () => {
     let { children, head, title = DEFAULT_TITLE } = handle.props
+    let { href, importMap, preloads } = scriptEntry

     return (
       <html lang="en">
         <head>
           {/* ... */}
-          {entryPreloads.map((href) => (
-            <link key={href} rel="modulepreload" href={href} />
+          <ImportMap value={importMap} />
+          {preloads.map((preloadHref) => (
+            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
           ))}
-          <script type="module" src={entryHref}></script>
+          <script type="module" src={href}></script>
         </head>
         {/* ... */}
```

`<ImportMap>` combines the entry map with mappings from blocking client entries so the initial document contains a single complete import map. Regular `<script type="importmap">` elements remain supported when this behavior is not needed.

The standard `render({ assets })` middleware resolves client entries with `getScriptEntry()` and includes their import maps in rendered documents and frame responses. Custom rendering pipelines must include the returned `importMap` in their `resolveClientEntry()` metadata.

3. If `app/actions/public/entry.tsx` calls `run()` to hydrate client entries, use the same support detection to select native imports or the polyfill and to process late preloads:

```ts
import {
  detectMultipleImportMapSupport,
  importShim,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'
import { run } from 'remix/ui'

let supportsMultipleImportMapsPromise = detectMultipleImportMapSupport()

run({
  async loadModule(moduleUrl, exportName) {
    let module = (await supportsMultipleImportMapsPromise)
      ? await import(moduleUrl)
      : await importShim(moduleUrl)

    return module[exportName]
  },
  async processClientEntryPreloads(preloads) {
    if (await supportsMultipleImportMapsPromise) return preloads

    preloadShim(preloads)
    return []
  },
})
```

Statically analyzable dynamic imports remain represented in import maps but no longer contribute to initial script entry preloads, so those modules are fetched when their import expression runs.
