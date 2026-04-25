import {
  ansiResetCode,
  ansiStyleCodes,
  createStyleFormatter,
  type TerminalStyle,
  type TerminalStyleName,
} from './styles.ts'

export type TerminalEnvironment = Record<string, string | undefined>

export interface TerminalInputStream {
  readonly isTTY?: boolean
}

export interface TerminalOutputStream {
  readonly isTTY?: boolean
  readonly columns?: number
  readonly rows?: number
  write(chunk: string): unknown
}

export interface UseColorOptions {
  /**
   * Explicitly enables or disables ANSI styles, overriding automatic detection.
   */
  colors?: boolean
  /**
   * The stream whose TTY support should be used for color detection.
   *
   * @default process.stdout
   */
  stream?: TerminalOutputStream
  /**
   * Environment variables used for color detection.
   *
   * @default process.env
   */
  env?: TerminalEnvironment
}

export interface TerminalStyles {
  readonly enabled: boolean
  readonly reset: string
  bgBlack: TerminalStyle
  bgBlackBright: TerminalStyle
  bgBlue: TerminalStyle
  bgBlueBright: TerminalStyle
  bgCyan: TerminalStyle
  bgCyanBright: TerminalStyle
  bgGray: TerminalStyle
  bgGreen: TerminalStyle
  bgGreenBright: TerminalStyle
  bgGrey: TerminalStyle
  bgMagenta: TerminalStyle
  bgMagentaBright: TerminalStyle
  bgRed: TerminalStyle
  bgRedBright: TerminalStyle
  bgWhite: TerminalStyle
  bgWhiteBright: TerminalStyle
  bgYellow: TerminalStyle
  bgYellowBright: TerminalStyle
  black: TerminalStyle
  blackBright: TerminalStyle
  blue: TerminalStyle
  blueBright: TerminalStyle
  bold: TerminalStyle
  cyan: TerminalStyle
  cyanBright: TerminalStyle
  dim: TerminalStyle
  format(value: string, ...styles: TerminalStyleName[]): string
  gray: TerminalStyle
  green: TerminalStyle
  greenBright: TerminalStyle
  grey: TerminalStyle
  hidden: TerminalStyle
  inverse: TerminalStyle
  italic: TerminalStyle
  magenta: TerminalStyle
  magentaBright: TerminalStyle
  overline: TerminalStyle
  red: TerminalStyle
  redBright: TerminalStyle
  strikethrough: TerminalStyle
  underline: TerminalStyle
  white: TerminalStyle
  whiteBright: TerminalStyle
  yellow: TerminalStyle
  yellowBright: TerminalStyle
}

export interface TerminalOptions extends UseColorOptions {
  /**
   * Input stream used to detect whether the terminal is interactive.
   *
   * @default process.stdin
   */
  stdin?: TerminalInputStream
  /**
   * Output stream used for normal output.
   *
   * @default process.stdout
   */
  stdout?: TerminalOutputStream
  /**
   * Output stream used for error output.
   *
   * @default process.stderr
   */
  stderr?: TerminalOutputStream
}

export interface Terminal {
  readonly env: TerminalEnvironment
  readonly stderr: TerminalOutputStream
  readonly stdin: TerminalInputStream
  readonly stdout: TerminalOutputStream
  readonly styles: TerminalStyles
  readonly columns: number | undefined
  readonly rows: number | undefined
  readonly isInteractive: boolean
  readonly isTTY: boolean
  clearLine(): void
  cursorTo(column: number, row?: number): void
  eraseDown(): void
  error(value: string): void
  errorLine(value?: string): void
  hideCursor(): void
  moveCursor(columns: number, rows: number): void
  showCursor(): void
  write(value: string): void
  writeLine(value?: string): void
}

export const ansi = {
  reset: ansiResetCode,
  ...ansiStyleCodes,
  clearLine: '\x1b[2K',
  eraseDown: '\x1b[J',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  cursorTo(column: number, row?: number): string {
    let normalizedColumn = normalizePosition(column) + 1

    if (row === undefined) {
      return `\x1b[${normalizedColumn}G`
    }

    let normalizedRow = normalizePosition(row) + 1
    return `\x1b[${normalizedRow};${normalizedColumn}H`
  },
  moveCursor(columns: number, rows: number): string {
    let horizontal = normalizeOffset(columns)
    let vertical = normalizeOffset(rows)
    let sequence = ''

    if (horizontal > 0) {
      sequence += `\x1b[${horizontal}C`
    } else if (horizontal < 0) {
      sequence += `\x1b[${Math.abs(horizontal)}D`
    }

    if (vertical > 0) {
      sequence += `\x1b[${vertical}B`
    } else if (vertical < 0) {
      sequence += `\x1b[${Math.abs(vertical)}A`
    }

    return sequence
  },
}

const escapeCharacter = String.fromCharCode(27)
const bellCharacter = String.fromCharCode(7)
const ansiPattern = new RegExp(
  `(?:${escapeCharacter}\\][\\s\\S]*?(?:${bellCharacter}|${escapeCharacter}\\\\))` +
    `|${escapeCharacter}\\[[0-?]*[ -/]*[@-~]`,
  'g',
)

const noopOutputStream: TerminalOutputStream = {
  write() {},
}

const noopInputStream: TerminalInputStream = {}

/**
 * Returns `true` when ANSI colors should be emitted for the given stream/environment.
 *
 * @param options Color detection options
 * @returns `true` when ANSI colors should be emitted
 */
export function shouldUseColors(options: UseColorOptions = {}): boolean {
  let env = options.env ?? getDefaultEnvironment()

  if (options.colors !== undefined) {
    return options.colors
  }

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

  let stream = options.stream ?? getDefaultStdout()
  return stream.isTTY === true
}

/**
 * Creates style helpers that either emit ANSI escape sequences or pass text through unchanged.
 *
 * @param options Style options
 * @returns Terminal style helpers
 */
export function createStyles(options: UseColorOptions = {}): TerminalStyles {
  let enabled = shouldUseColors(options)
  let { createStyle, format } = createStyleFormatter(enabled)

  return {
    enabled,
    reset: enabled ? ansi.reset : '',
    bgBlack: createStyle('bgBlack'),
    bgBlackBright: createStyle('bgBlackBright'),
    bgBlue: createStyle('bgBlue'),
    bgBlueBright: createStyle('bgBlueBright'),
    bgCyan: createStyle('bgCyan'),
    bgCyanBright: createStyle('bgCyanBright'),
    bgGray: createStyle('bgGray'),
    bgGreen: createStyle('bgGreen'),
    bgGreenBright: createStyle('bgGreenBright'),
    bgGrey: createStyle('bgGrey'),
    bgMagenta: createStyle('bgMagenta'),
    bgMagentaBright: createStyle('bgMagentaBright'),
    bgRed: createStyle('bgRed'),
    bgRedBright: createStyle('bgRedBright'),
    bgWhite: createStyle('bgWhite'),
    bgWhiteBright: createStyle('bgWhiteBright'),
    bgYellow: createStyle('bgYellow'),
    bgYellowBright: createStyle('bgYellowBright'),
    black: createStyle('black'),
    blackBright: createStyle('blackBright'),
    blue: createStyle('blue'),
    blueBright: createStyle('blueBright'),
    bold: createStyle('bold'),
    cyan: createStyle('cyan'),
    cyanBright: createStyle('cyanBright'),
    dim: createStyle('dim'),
    format,
    gray: createStyle('gray'),
    green: createStyle('green'),
    greenBright: createStyle('greenBright'),
    grey: createStyle('grey'),
    hidden: createStyle('hidden'),
    inverse: createStyle('inverse'),
    italic: createStyle('italic'),
    magenta: createStyle('magenta'),
    magentaBright: createStyle('magentaBright'),
    overline: createStyle('overline'),
    red: createStyle('red'),
    redBright: createStyle('redBright'),
    strikethrough: createStyle('strikethrough'),
    underline: createStyle('underline'),
    white: createStyle('white'),
    whiteBright: createStyle('whiteBright'),
    yellow: createStyle('yellow'),
    yellowBright: createStyle('yellowBright'),
  }
}

/**
 * Creates a small terminal abstraction around stdout/stderr/stdin.
 *
 * @param options Terminal stream and style options
 * @returns A terminal abstraction
 */
export function createTerminal(options: TerminalOptions = {}): Terminal {
  let stdin = options.stdin ?? getDefaultStdin()
  let stdout = options.stdout ?? getDefaultStdout()
  let stderr = options.stderr ?? getDefaultStderr()
  let env = options.env ?? getDefaultEnvironment()
  let styles = createStyles({
    colors: options.colors,
    env,
    stream: options.stream ?? stdout,
  })

  return {
    env,
    stderr,
    stdin,
    stdout,
    styles,
    get columns() {
      return stdout.columns
    },
    get rows() {
      return stdout.rows
    },
    get isInteractive() {
      return stdin.isTTY === true && stdout.isTTY === true
    },
    get isTTY() {
      return stdout.isTTY === true
    },
    clearLine() {
      stdout.write(ansi.clearLine)
    },
    cursorTo(column, row) {
      stdout.write(ansi.cursorTo(column, row))
    },
    eraseDown() {
      stdout.write(ansi.eraseDown)
    },
    error(value) {
      stderr.write(value)
    },
    errorLine(value = '') {
      stderr.write(value + '\n')
    },
    hideCursor() {
      stdout.write(ansi.hideCursor)
    },
    moveCursor(columns, rows) {
      stdout.write(ansi.moveCursor(columns, rows))
    },
    showCursor() {
      stdout.write(ansi.showCursor)
    },
    write(value) {
      stdout.write(value)
    },
    writeLine(value = '') {
      stdout.write(value + '\n')
    },
  }
}

/**
 * Removes ANSI escape sequences from a string.
 *
 * @param value The string to strip
 * @returns The string without ANSI escape sequences
 */
export function stripAnsi(value: string): string {
  return value.replace(ansiPattern, '')
}

function normalizePosition(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.trunc(value))
}

function normalizeOffset(value: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : 0
}

function getDefaultEnvironment(): TerminalEnvironment {
  return typeof process === 'undefined' ? {} : process.env
}

function getDefaultStdin(): TerminalInputStream {
  return typeof process === 'undefined' ? noopInputStream : process.stdin
}

function getDefaultStdout(): TerminalOutputStream {
  return typeof process === 'undefined' ? noopOutputStream : process.stdout
}

function getDefaultStderr(): TerminalOutputStream {
  return typeof process === 'undefined' ? noopOutputStream : process.stderr
}
