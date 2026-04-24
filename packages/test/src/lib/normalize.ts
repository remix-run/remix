// https://bun.com/docs/guides/util/detect-bun
export const IS_BUN = typeof process.versions.bun === 'string'

function normalizeFilePath(path: string): string {
  let locSuffix = path.match(/(:\d+:\d+)$/)?.[0] || ''
  let normalized =
    path
      .replace(/^\/scripts\/@pkg\/([^):]+)/g, (...args) => args[1])
      .replace(/^\/scripts\/@test\/([^):]+)/g, (...args) => args[1])
      .replace(/^\/scripts\/([^):]+)/g, (...args) => args[1])
      .replace(/^\s+/, '  ') + locSuffix

  return path.includes('/@test/') ? `./${normalized}` : normalized
}

export function normalizeLine(line: string): string {
  let match = line.match(/ \(.*\)$/)
  if (match) {
    let filepath = match[0].slice(2, -1)
    filepath = filepath.replace(/https?:\/\/localhost:\d+\//g, '/')
    return line.slice(0, match.index) + ' (' + normalizeFilePath(filepath) + ')'
  }

  return line
}
