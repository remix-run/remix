BREAKING CHANGE: Browser scripts now use import maps to resolve imports instead of rewriting import specifiers to asset URLs (see #11706). Apps must render each script entry's import map before its modulepreload links and module script.

To migrate an app created from the Remix app template:

In `app/assets.ts`, replace the separate entry href and preload calls with `getScriptEntry()`:

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

In `app/actions/document.tsx`, render the managed import map before the entry's preloads and module script:

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

In `app/actions/public/entry.ts`, use `importModule()` to load client entries and `processClientEntryPreloads` to preload them in browsers that need the polyfill:

```ts
import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'
import { run } from 'remix/ui'

run({
  async loadModule(moduleUrl, exportName) {
    let module = await importModule(moduleUrl)
    let Component = module[exportName]
    if (typeof Component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads

    preloadShim(preloads)
    return []
  },
})
```

Modules referenced by dynamic `import()` expressions are now fetched when the import runs, instead of being preloaded with the entry script. Imports with static specifiers still have entries in the import map.

The HMR module importer must be included in the initial import map. Importing it from the main client entry, as shown above, meets this requirement. If your app sets a Content Security Policy, follow the [polyfill CSP requirements](https://github.com/remix-run/remix/tree/main/packages/multiple-import-maps-polyfill#content-security-policy).

If you call `renderToStream()` directly, resolve client entries with `getScriptEntry()` and include their `importMap` in the object returned from `resolveClientEntry()`:

```diff
 let stream = renderToStream(node, {
   async resolveClientEntry(entryId, component) {
-    let [href, preloads] = await Promise.all([
-      assets.getHref(entryId),
-      assets.getPreloads(entryId),
-    ])
+    let { href, importMap, preloads } = await assets.getScriptEntry(entryId)

     return {
       href,
+      importMap,
       exportName: component.name,
       preloads,
     }
   },
 })
```

`assets.getImportMap()` combines import maps for multiple script entries. The public types are `ScriptEntry` and `ScriptImportMap`.

In development, HMR installs new import map entries before loading an update. If an existing mapping would change, it reloads the page. Custom HMR importers can use `hmr.moduleImporter`, a module specifier resolved relative to the asset server root. That module must export `importModule(specifier, parentUrl)`.
