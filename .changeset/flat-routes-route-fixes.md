---
"remix": patch
"@remix-run/dev": patch
---

fixes flat route inconsistencies where `route.{ext}` wasn't always being treated like `index.{ext}` when used in a folder

route conflict no longer throw errors and instead display a helpful warning that we're using the first one we found.

```log
⚠️ Route Path Collision: "/products/:pid"

The following routes all define the same URL, only the first one will be used

🟢️️ routes/products.$pid.tsx
⭕️️ routes/products.$productId.tsx
```

```log
⚠️ Route Path Collision: "/dashboard"

The following routes all define the same URL, only the first one will be used

🟢️️ routes/dashboard/route.tsx
⭕️️ routes/dashboard.tsx
```

```log
⚠️ Route Path Collision: "/"

The following routes all define the same URL, only the first one will be used

🟢️️ routes/_landing._index.tsx
⭕️️ routes/_dashboard._index.tsx
⭕️ routes/_index.tsx
```
