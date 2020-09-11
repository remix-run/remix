export function purgeRequireCache(prefix: string): void {
  for (let key of Object.keys(require.cache)) {
    if (key.startsWith(prefix)) {
      delete require.cache[key];
    }
  }
}
