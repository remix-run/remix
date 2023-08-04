---
"@remix-run/dev": patch
---

Remove outdated ESM import warnings

Most of the time these warnings were false positives.
Instead, we now rely on built-in Node warnings for ESM imports.
