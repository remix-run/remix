const path = require("path");

/**
 * Purges all entries that begin with the given prefix from node's internal
 * require cache. In Remix, the following files are loaded via CommonJS require:
 *
 * - /app/remix.config.js
 * - /app/src/routes/*
 * - /app/loaders/*
 *
 * This function is useful for clearing all of these from the require cache in
 * dev mode.
 */
export function purgeRequireCache(prefix: string): void {
  let nodeModules = path.join(prefix, "node_modules");
  for (let key of Object.keys(require.cache)) {
    if (key.startsWith(prefix) && !key.startsWith(nodeModules)) {
      delete require.cache[key];
    }
  }
}
