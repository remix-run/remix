---
"@remix-run/server-runtime": patch
---

Avoid circular references and infinite recursion in types

"Pretty" or simplified Typescript types are evaluated by eagerly resolving types.
For complex types with circular references, this can cause TS to recurse infinitely.

To fix this, pretty types are reverted as a built-in DX feature of useLoaderData, useActionData, etc...
