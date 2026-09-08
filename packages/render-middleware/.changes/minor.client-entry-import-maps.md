BREAKING CHANGE: `render({ assets })` now uses `assets.getScriptEntry()` to resolve client entries from source files so their import maps are included in rendered documents and frame responses. Custom asset server implementations must provide `getScriptEntry()` instead of `getHref()` and `getPreloads()`. It must return a `Promise` resolving to the following `ScriptEntry` shape:

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

Apps using `createAssetServer()` receive this integration automatically. Custom rendering setups can follow the [asset server migration steps](https://github.com/remix-run/remix/blob/main/packages/assets/CHANGELOG.md#v070) (see #11706).
