---
"remix": patch
"@remix-run/dev": patch
---

flat route fixes and enhancements

`app._index.tsx` and `app/index.tsx` are different routes. The first is an index route for the second, and will be rendered into the parent outlet. The second is the parent route itself.

`index.tsx` no longer has any semantic meaning for "index routes", but rather the node module resolution convention of "index modules".

`routes/app.tsx` and `routes/app/index.tsx` *are the same route*. You just moved it to a folder and made an `index.tsx` because that's how node module resolution looks for the module at `routes/app`.

If you want an index route, you use `_index`

| file name | route path | layout |
|-------|-----------|--------|
| `routes/index.tsx` | `/index` | root |
| `routes/_index.tsx` | `/` | root |
| `routes/app.tsx` | `/app` | root |
| `routes/app/index.tsx` | same route as above | root |
| `routes/app._index.tsx` | `/app` | `routes/app.tsx` or `routes/app/index.tsx` |
| `routes/app._index/index.tsx` | same route as above | `routes/app.tsx` or `routes/app/index.tsx` |
