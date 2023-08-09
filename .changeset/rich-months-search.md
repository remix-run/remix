---
"@remix-run/dev": major
---

remove deprecated cli args and flags

- `--no-restart`/`restart` 👉 use `--manual`/`manual` instead
- `--scheme`/`scheme` and `--host`/`host` 👉 use `REMIX_DEV_ORIGIN` instead
