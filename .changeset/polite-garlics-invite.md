---
"@remix-run/server-runtime": patch
---

Added `this: void` to functions in the `SessionStorage` and `SessionIdStorageStrategy` interfaces so destructuring is correctly part of the contract.
