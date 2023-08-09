---
"@remix-run/vercel": major
---

The `@remix-run/vercel` runtime adapter has been removed in favor of out of the box Vercel functionality. Please update
your code by removing `@remix-run/vercel` & `@vercel/node` from your `package.json`, removing your
`server.ts`/`server.js` file, and removing the `server` & `serverBuildPath` options from your `remix.config.js`.

Due to the removal of this adapter, we also removed our [Vercel template][vercel-template] in favor of the
[official Vercel template][official-vercel-template].

[vercel-template]: https://github.com/remix-run/remix/tree/main/templates/vercel
[official-vercel-template]: https://github.com/vercel/vercel/tree/main/examples/remix
