BREAKING CHANGE: Browser scripts now keep JavaScript imports as authored and use import maps for resolution. Apps must render each script entry's import map before its modulepreload links and module script.

To migrate an app created from the Remix app template, replace the separate entry href and preload calls with `getScriptEntry()` in `app/assets.ts`:

```diff
 const entry = 'app/actions/public/entry.ts'
-export const entryHref = await assetServer.getHref(entry)
-export const entryPreloads = await assetServer.getPreloads(entry)
+export const scriptEntry = await assetServer.getScriptEntry(entry)
```

Render the script entry's import map before its preloads and module script in `app/actions/document.tsx`:

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

Resolve client entries with `getScriptEntry()` and include their `importMap` in the object returned from `resolveClientEntry()`:

```diff
 let stream = renderToStream(node, {
   async resolveClientEntry(entryId, component) {
-    let [href, preloads] = await Promise.all([
-      assetServer.getHref(entryId),
-      assetServer.getPreloads(entryId),
-    ])
+    let { href, importMap, preloads } = await assetServer.getScriptEntry(entryId)

     return {
       href,
+      importMap,
       exportName: component.name,
       preloads,
     }
   },
 })
```

`assetServer.getImportMap()` creates a combined import map for multiple script roots or custom graph-level behavior. The corresponding public types are available as `ScriptEntry` and `ScriptImportMap`.

In development, HMR installs any new import map entries required by an accepted module graph before evaluating the update and reloads the page if an installed mapping would need to change.
