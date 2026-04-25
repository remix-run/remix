export type Counts = {
  passed: number
  failed: number
  skipped: number
  todo: number
}

// https://bun.com/docs/guides/util/detect-bun
export const IS_BUN = typeof process.versions.bun === 'string'

const noColor = process.env.CI === 'true' || !!process.env.NO_COLOR

export const colors = {
  reset: noColor ? '' : '\x1b[0m',
  dim: noColor ? (s: string) => s : (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: noColor ? (s: string) => s : (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: noColor ? (s: string) => s : (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: noColor ? (s: string) => s : (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: noColor ? (s: string) => s : (s: string) => `\x1b[2m\x1b[33m${s}\x1b[0m`,
}

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
