Stop `loadModule()` from printing a `module.register()` deprecation warning (`DEP0205`) on Node.js 26. Scoped loaders now register synchronous in-thread hooks with `module.registerHooks()`.
