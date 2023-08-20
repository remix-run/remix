---
"@remix-run/dev": patch
---

Support dependencies that import polyfill packages for Node built-ins via a trailing slash (e.g. importing the `buffer` package with `var Buffer = require('buffer/').Buffer` as recommended in their readme). These imports were previously marked as external. This meant that they were left as dynamic imports in the client bundle and would throw a runtime error in the browser (e.g. `Dynamic require of "buffer/" is not supported`).
