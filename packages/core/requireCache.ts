/**
 * Purges all entries that begin with the given prefix from node's internal
 * require cache. In Remix, the following files are loaded via CommonJS require:
 *
 * - /remix.config.js
 * - <serverBuildDirectory>/entry-server.js
 * - <serverBuildDirectory>/routes/*
 * - <dataDirectory>/*
 *
 * This function is useful for clearing all of these from the require cache when
 * running the build in watch mode.
 */
export function purgeRequireCache(
  prefix: string,
  includeNodeModules = false
): void {
  for (let key of Object.keys(require.cache)) {
    if (
      key.startsWith(prefix) &&
      (includeNodeModules || !/\bnode_modules\b/.test(key))
    ) {
      delete require.cache[key];
    }
  }
}
