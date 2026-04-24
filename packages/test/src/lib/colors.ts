const noColor = process.env.CI === 'true' || !!process.env.NO_COLOR

export const colors = {
  reset: noColor ? '' : '\x1b[0m',
  dim: noColor ? (s: string) => s : (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: noColor ? (s: string) => s : (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: noColor ? (s: string) => s : (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: noColor ? (s: string) => s : (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: noColor ? (s: string) => s : (s: string) => `\x1b[2m\x1b[33m${s}\x1b[0m`,
}
