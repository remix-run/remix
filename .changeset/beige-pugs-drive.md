---
"@remix-run/serve": major
---

`remix-serve` picks an open port if 3000 is taken

- If `PORT` env var is set, `remix-serve` will use that port
- Otherwise, `remix-serve` picks an open port (3000 unless that is already taken)
