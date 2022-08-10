---
"remix": patch
"@remix-run/dev": patch
---

`import()` expects url-encoded strings, so the path must be properly escaped and (especially on Windows) absolute paths must pe prefixed with the `file://` protocol
      
dynamic import does not currently work inside of vm which jest relies on so we fall back to require for this case
