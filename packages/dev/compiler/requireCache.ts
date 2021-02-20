/**
 * Purges all entries that begin with the given prefix from node's internal
 * require cache.
 *
 * This is useful when running the Remix build in watch mode because we
 * currently load the Remix config using CommonJS require, which means that it
 * can require() other files it might need. So we just purge them all to make
 * sure we pick up the latest changes.
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
