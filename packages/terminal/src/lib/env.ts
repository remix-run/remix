/**
 * Environment variables used to decide terminal behavior.
 */
export type TerminalEnvironment = Record<string, string | undefined>

/**
 * Options that control ANSI color detection.
 */
export interface ColorSupportOptions {
  /**
   * Output stream whose TTY support should be used for color detection (defaults to `process.stdout`).
   */
  stream?: {
    /**
     * Whether the output stream is attached to a TTY.
     */
    readonly isTTY?: boolean
  }
  /**
   * Environment variables used for color detection (defaults to `process.env`).
   */
  env?: TerminalEnvironment
}

/**
 * Returns `true` when ANSI colors should be emitted for the given stream/environment.
 *
 * @param options Color detection options
 * @returns `true` when ANSI colors should be emitted
 */
export function shouldUseColors(options: ColorSupportOptions = {}): boolean {
  let env = options.env ?? getDefaultEnvironment()

  if (env.NO_COLOR !== undefined) {
    return false
  }

  let forceColor = env.FORCE_COLOR

  if (forceColor !== undefined) {
    let value = forceColor.toLowerCase()
    return value !== '0' && value !== 'false'
  }

  if (env.CI === 'true') {
    return false
  }

  if (env.TERM === 'dumb') {
    return false
  }

  let stream = options.stream ?? getDefaultColorStream()
  return stream.isTTY === true
}

/**
 * Returns the current process environment when it is available.
 *
 * @returns Current process environment variables, or an empty object outside Node-compatible runtimes.
 */
export function getDefaultEnvironment(): TerminalEnvironment {
  return typeof process === 'undefined' ? {} : process.env
}

function getDefaultColorStream(): NonNullable<ColorSupportOptions['stream']> {
  return typeof process === 'undefined' ? {} : process.stdout
}
