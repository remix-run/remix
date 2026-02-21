You can now pass an object containing metadata about the client entry instead of a string.

This brings support for:

- css side-effects
- holding render on critical css for lazy frames
- bundlers
- flattening the request waterfall
  - If before it was:
    ```
    /doc
        /entry.js
        /client-comp.js
                        /client-comp-dep.js
                                            /client-comp-dep-imp.js
    ```
    You can now optimize it to:
    ```
    /doc
        /entry.js
        /client-comp.js
        /client-comp-dep.js
        /client-comp-dep-imp.js
    ```

Old API: `clientEntry(href: string, component)`
New API: `clientEntry(asset: string | AssetMetadata, component)`

```ts
/**
 * A style required for hydration.
 */
type HydrationStyle = { href: string } & Omit<Props<'link'>, 'children' | 'rel'>

/**
 * A script required for hydration.
 */
export type HydrationScript = { src: string } & Omit<Props<'script'>, 'children' | 'src' | 'type'>

/**
 * Component asset loading metadata
 */
type AssetMetadata = {
  exportName: string
  js: [HydrationScript, ...HydrationScript[]]
  css?: HydrationStyle[]
}
```
