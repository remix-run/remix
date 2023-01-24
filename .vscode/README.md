A note on `deno_resolve_npm_imports.json`

The `"imports"` field in `deno_resolve_npm_imports.json` is used to resolve NPM imports for `packages/remix-deno`. This import map is used solely for the d`enoland.vscode-deno` extension.

Remix does not support import maps. Dependency management is done through `npm` and `node_modules/` instead. Deno-only dependencies may be imported via URL imports (without using import maps).
