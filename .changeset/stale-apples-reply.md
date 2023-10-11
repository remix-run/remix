---
"@remix-run/react": patch
"@remix-run/server-runtime": patch
---

Emulate types for `JSON.parse(JSON.stringify(x))` in `SerializeFrom`

Notably, type fields that are only assignable to `undefined` after serialization are now omitted since
`JSON.stringify |> JSON.parse` will omit them. See test cases for examples.

Also fixes type errors when upgrading to v2 from 1.19
