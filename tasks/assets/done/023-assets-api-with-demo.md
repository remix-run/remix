### Assets API with demo integration

Added `context.assets` API to fetch-router and integrated it into the demo app.

**What was done:**

- `Assets` and `AssetEntry` types added to `RequestContext` in fetch-router
- `context.assets` property on `RequestContext` (warns + returns stub if middleware not configured)
- `assets.get('entry.tsx')` returns `{ href, chunks }` or `null` if not found
- Demo app uses `context.assets.get('entry.tsx')` instead of hardcoded path
- Demo includes `<link rel="modulepreload">` for all chunks

**Key decisions:**

- Types live in fetch-router since `context.assets` is first-class like `session`
- `assets.get()` returns `null` for missing entries (caller decides what to do)
- If middleware not configured, warns and returns stub (like `session` pattern)
- `createDevAssets` is internal only (not exported from public API)
