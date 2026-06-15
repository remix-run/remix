export function shouldIgnoreWatchPath(path: string): boolean {
  let parts = path.split(/[\\/]/)

  return parts.some((part) =>
    ['.git', '.next', '.turbo', 'build', 'coverage', 'dist', 'node_modules'].includes(part),
  )
}
