/**
 * ANSI color codes for terminal output.
 */
const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const MAGENTA = '\x1b[35m'

/**
 * Colorizes a log token based on its name and value.
 *
 * @param tokenName The name of the token to colorize (e.g., 'status', 'method').
 * @param value The string value of the token to be colorized.
 * @param rawValue The raw, numeric value of the token, used for threshold-based coloring.
 * @returns The colorized string, wrapped in ANSI color codes.
 */
export function colorizeToken(tokenName: string, value: string, rawValue?: number): string {
  switch (tokenName) {
    case 'status':
      return colorizeStatus(value, rawValue)
    case 'durationPretty':
      return colorizeDuration(value, rawValue)
    case 'contentLengthPretty':
      return colorizeContentLength(value, rawValue)
    case 'method':
      return colorizeMethod(value)
    default:
      return value
  }
}

function colorizeStatus(value: string, status?: number): string {
  if (!status) return value
  if (status >= 500) return `${RED}${value}${RESET}`
  if (status >= 400) return `${YELLOW}${value}${RESET}`
  if (status >= 300) return `${CYAN}${value}${RESET}`
  if (status >= 200) return `${GREEN}${value}${RESET}`
  return value
}

function colorizeDuration(value: string, duration?: number): string {
  if (duration === undefined) return value
  if (duration >= 1000) return `${RED}${value}${RESET}`
  if (duration >= 500) return `${MAGENTA}${value}${RESET}`
  if (duration >= 100) return `${YELLOW}${value}${RESET}`
  return `${GREEN}${value}${RESET}`
}

const ONE_MB = 1024 * 1024
const ONE_HUNDRED_KB = 100 * 1024
const ONE_KB = 1024

function colorizeContentLength(value: string, length?: number): string {
  if (length === undefined) return value
  if (length >= ONE_MB) return `${RED}${value}${RESET}`
  if (length >= ONE_HUNDRED_KB) return `${YELLOW}${value}${RESET}`
  if (length >= ONE_KB) return `${CYAN}${value}${RESET}`
  return value
}

function colorizeMethod(value: string): string {
  switch (value.toUpperCase()) {
    case 'GET':
      return `${GREEN}${value}${RESET}`
    case 'POST':
      return `${CYAN}${value}${RESET}`
    case 'PUT':
    case 'PATCH':
      return `${YELLOW}${value}${RESET}`
    case 'DELETE':
      return `${RED}${value}${RESET}`
    case 'HEAD':
    case 'OPTIONS':
      return `${MAGENTA}${value}${RESET}`
    default:
      return value
  }
}
