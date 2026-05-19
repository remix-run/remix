Expose `@remix-run/node-tsx` through `remix/node-tsx` and `remix/node-tsx/load-module`.

Use `node --import remix/node-tsx` to run `.ts`, `.tsx`, and `.jsx` files directly in Node.js with TypeScript and JSX syntax support. The loader transforms TypeScript syntax that requires JavaScript output, including enums, runtime namespaces, and parameter properties, while preserving Node.js module resolution.
