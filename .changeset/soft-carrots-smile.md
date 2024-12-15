---
"@remix-run/dev": patch
---

Stop calling `process.exit(0)` on successful CLI runs to avoid exiting prior to flushing the stdout buffers
