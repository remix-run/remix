---
"@remix-run/node": patch
---

Switch from `crypto.randomBytes` to `crypto.webcrypto.getRandomValues` for file session storage ID generation
