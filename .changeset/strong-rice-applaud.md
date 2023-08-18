---
"@remix-run/netlify": major
---

The `@remix-run/netlify` runtime adapter has removed in favor of [`@netlify/remix-adapter`][official-netlify-adapter]
& [`@netlify/remix-edge-adapter`][official-netlify-edge-adapter]. Please update your code by changing all
`@remix-run/netlify` imports to `@netlify/remix-adapter`.  
Keep in mind that `@netlify/remix-adapter` requires `@netlify/functions@^1.0.0`, which is a breaking change compared
to the previous supported `@netlify/functions` versions in `@remix-run/netlify`.

Due to the removal of this adapter, we also removed our [Netlify template][netlify-template] in favor of the
[official Netlify template][official-netlify-template].

[official-netlify-adapter]: https://github.com/netlify/remix-compute/tree/main/packages/remix-adapter
[official-netlify-edge-adapter]: https://github.com/netlify/remix-compute/tree/main/packages/remix-edge-adapter
[netlify-template]: https://github.com/remix-run/remix/tree/main/templates/netlify
[official-netlify-template]: https://github.com/netlify/remix-template
