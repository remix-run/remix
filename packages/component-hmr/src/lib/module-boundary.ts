export function getComponentModuleInvalidationMessage(
  nextExports: object,
  previousExports: object,
  componentNames: readonly string[],
): string | null {
  let previousNames = Object.keys(previousExports)
  for (let name of previousNames) {
    if (!Object.prototype.hasOwnProperty.call(nextExports, name)) {
      return `Updated component module removed export "${name}"`
    }
  }
  for (let name of Object.keys(nextExports)) {
    if (!Object.prototype.hasOwnProperty.call(previousExports, name)) {
      return `Updated component module added export "${name}"`
    }
  }
  for (let name of previousNames) {
    if (componentNames.includes(name)) continue
    if (Reflect.get(previousExports, name) !== Reflect.get(nextExports, name)) {
      return `Updated component module changed non-component export "${name}"`
    }
  }
  return null
}
