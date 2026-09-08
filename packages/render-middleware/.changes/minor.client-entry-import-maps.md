BREAKING CHANGE: `render({ assets })` now resolves source-based client entries with `assets.getScriptEntry()` so their import maps are included in rendered documents and frame responses. Custom asset server implementations must provide `getScriptEntry()` instead of `getHref()` and `getPreloads()`. It must return a `Promise` resolving to the following `ScriptEntry` shape:

```ts
interface ScriptEntry {
  href: string
  preloads: string[]
  importMap: {
    imports: Record<string, string>
    scopes?: Record<string, Record<string, string>>
  }
}
```
