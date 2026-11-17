New apps created with `remix new` on Windows can run `npm run dev` and `npm start` again. The generated scripts used `cross-env-shell`, which rewrote `--import remix/node-tsx` to `--import remix\node-tsx` on Windows and failed with `ERR_INVALID_MODULE_SPECIFIER`. Windows scripts now use `cross-env` instead.

Apps generated on Windows with an earlier version can update their `package.json` scripts the same way:

```diff
 "scripts": {
-  "dev": "cross-env-shell NODE_ENV=development \"node --watch --import remix/node-tsx server.ts\"",
-  "hmr": "cross-env-shell NODE_ENV=development \"node hmr.ts\"",
-  "start": "cross-env-shell NODE_ENV=production \"node --import remix/node-tsx server.ts\"",
-  "test": "cross-env-shell NODE_ENV=test \"remix test\""
+  "dev": "cross-env NODE_ENV=development node --watch --import remix/node-tsx server.ts",
+  "hmr": "cross-env NODE_ENV=development node hmr.ts",
+  "start": "cross-env NODE_ENV=production node --import remix/node-tsx server.ts",
+  "test": "cross-env NODE_ENV=test remix test"
 }
```
