---
"@remix-run/dev": minor
---

Vite: Error messages when .server files are referenced by client

Previously, referencing a `.server` module from client code resulted in an error message like:

```txt
The requested module '/app/models/answer.server.ts' does not provide an export named 'isDateType'
```

Which was confusing because `answer.server.ts` _does_ provide the `isDateType` export,
but Remix was replacing `.server` modules with empty modules (`export {}`) for the client build.

Now, Remix explicitly fails at compile time when a `.server` module is referenced from client code
and includes dedicated error messages depending on whether the import occurs in a route or a non-route
module. The error messages also include links to relevant documentation.
