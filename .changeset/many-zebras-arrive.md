---
"@remix-run/dev": patch
---

Fix TS->JS conversion when creating a new Remix project via the CLI

The TS->JS migration was removed from the CLI codemod options, but still
used for TS->JS conversion when creating a new Remix project from the
CLI. The TS modules responsible for the TS->JS conversion were
incorrectly removed from the Rollup build, resulting in the
corresponding built JS modules being absent. That caused the CLI to
error when trying to perform TS->JS conversion. This changes
reintroduces the wiring to build the modules responsible for the TS->JS
conversion.
