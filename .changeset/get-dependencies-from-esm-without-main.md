---
"@remix-run/dev": patch
---

Update `getDependenciesToBundle` to handle ESM packages without main exports. Note that these packages must expose `package.json` in their `exports` field so that their path can be resolved.
