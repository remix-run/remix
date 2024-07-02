---
"@remix-run/react": patch
"@remix-run/server-runtime": patch
---

- Change initial hydration route mismatch from a URL check to a matches check to be resistant to URL inconsistenceis
  - Also, add loop prevention detection using `sessionStorage`
