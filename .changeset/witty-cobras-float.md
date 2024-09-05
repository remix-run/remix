---
"@remix-run/dev": minor
---

Added Deno project detection which is done by checking for the presence of a deno.json or deno.jsonc file.
It is no longer a hard requirement to have a package.json file in the project. For a Deno project, dependencies can be added via the `deno add` command to a deno.json or deno.jsonc file instead.