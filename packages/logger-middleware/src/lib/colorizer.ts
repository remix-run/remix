const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const MAGENTA = '\x1b[35m'

export class Colorizer {
  readonly #enabled?: boolean

  constructor(colors?: boolean) {
    this.#enabled = colors
  }

  #colorize(text: string, color: string): string {
    return this.#enabled ? `${color}${text}${RESET}` : text
  }

  status(code: number): string {
    let value = String(code)
    if (!this.#enabled) return value
    if (code >= 500) return this.#colorize(value, MAGENTA)
    if (code >= 400) return this.#colorize(value, RED)
    if (code >= 300) return this.#colorize(value, CYAN)
    if (code >= 200) return this.#colorize(value, GREEN)
    return value
  }

  method(method: string): string {
    if (!this.#enabled) return method
    switch (method.toUpperCase()) {
      case 'GET':
        return this.#colorize(method, GREEN)
      case 'POST':
        return this.#colorize(method, CYAN)
      case 'PUT':
      case 'PATCH':
        return this.#colorize(method, YELLOW)
      case 'DELETE':
        return this.#colorize(method, RED)
      case 'HEAD':
      case 'OPTIONS':
        return this.#colorize(method, MAGENTA)
      default:
        return method
    }
  }

  duration(ms: number, prettyValue: string): string {
    if (!this.#enabled) return prettyValue
    if (ms >= 1000) return this.#colorize(prettyValue, RED)
    if (ms >= 500) return this.#colorize(prettyValue, MAGENTA)
    if (ms >= 100) return this.#colorize(prettyValue, YELLOW)
    return this.#colorize(prettyValue, GREEN)
  }

  contentLength(bytes: number | undefined, prettyValue: string): string {
    let ONE_MB = 1024 * 1024
    let ONE_HUNDRED_KB = 100 * 1024
    let ONE_KB = 1024

    if (!this.#enabled || bytes === undefined) return prettyValue
    if (bytes >= ONE_MB) return this.#colorize(prettyValue, RED)
    if (bytes >= ONE_HUNDRED_KB) return this.#colorize(prettyValue, YELLOW)
    if (bytes >= ONE_KB) return this.#colorize(prettyValue, CYAN)
    return prettyValue
  }
}
