import {
  ansiResetCode,
  ansiStyleCodes,
  createStyleFormatter,
  type TerminalStyle,
  type TerminalStyleName,
} from './styles.ts'

/**
 * Environment variables used to decide terminal behavior.
 */
export type TerminalEnvironment = Record<string, string | undefined>

/**
 * Input stream shape used for terminal interactivity detection.
 */
export interface TerminalInputStream {
  /**
   * Whether the input stream is attached to a TTY.
   */
  readonly isTTY?: boolean
}

/**
 * Output stream shape used for terminal writes and display detection.
 */
export interface TerminalOutputStream {
  /**
   * Whether the output stream is attached to a TTY.
   */
  readonly isTTY?: boolean
  /**
   * Current terminal column count, when known.
   */
  readonly columns?: number
  /**
   * Current terminal row count, when known.
   */
  readonly rows?: number
  /**
   * Writes a chunk of text to the output stream.
   *
   * @param chunk Text chunk to write.
   * @returns Stream-specific write result.
   */
  write(chunk: string): unknown
}

/**
 * Options that control ANSI color detection.
 */
export interface UseColorOptions {
  /**
   * Explicitly enables or disables ANSI styles instead of using automatic detection.
   */
  colors?: boolean
  /**
   * Output stream whose TTY support should be used for color detection (defaults to `process.stdout`).
   */
  stream?: TerminalOutputStream
  /**
   * Environment variables used for color detection (defaults to `process.env`).
   */
  env?: TerminalEnvironment
}

/**
 * Style helpers returned by `createStyles()` and `createTerminal()`.
 */
export interface TerminalStyles {
  /**
   * Whether style helpers emit ANSI escape sequences.
   */
  readonly enabled: boolean
  /**
   * ANSI reset sequence when styles are enabled, otherwise an empty string.
   */
  readonly reset: string
  /**
   * Formats text with a black background.
   */
  bgBlack: TerminalStyle
  /**
   * Formats text with a bright black background.
   */
  bgBlackBright: TerminalStyle
  /**
   * Formats text with a blue background.
   */
  bgBlue: TerminalStyle
  /**
   * Formats text with a bright blue background.
   */
  bgBlueBright: TerminalStyle
  /**
   * Formats text with a cyan background.
   */
  bgCyan: TerminalStyle
  /**
   * Formats text with a bright cyan background.
   */
  bgCyanBright: TerminalStyle
  /**
   * Formats text with a gray background.
   */
  bgGray: TerminalStyle
  /**
   * Formats text with a green background.
   */
  bgGreen: TerminalStyle
  /**
   * Formats text with a bright green background.
   */
  bgGreenBright: TerminalStyle
  /**
   * Formats text with a grey background.
   */
  bgGrey: TerminalStyle
  /**
   * Formats text with a magenta background.
   */
  bgMagenta: TerminalStyle
  /**
   * Formats text with a bright magenta background.
   */
  bgMagentaBright: TerminalStyle
  /**
   * Formats text with a red background.
   */
  bgRed: TerminalStyle
  /**
   * Formats text with a bright red background.
   */
  bgRedBright: TerminalStyle
  /**
   * Formats text with a white background.
   */
  bgWhite: TerminalStyle
  /**
   * Formats text with a bright white background.
   */
  bgWhiteBright: TerminalStyle
  /**
   * Formats text with a yellow background.
   */
  bgYellow: TerminalStyle
  /**
   * Formats text with a bright yellow background.
   */
  bgYellowBright: TerminalStyle
  /**
   * Formats text with black foreground color.
   */
  black: TerminalStyle
  /**
   * Formats text with bright black foreground color.
   */
  blackBright: TerminalStyle
  /**
   * Formats text with blue foreground color.
   */
  blue: TerminalStyle
  /**
   * Formats text with bright blue foreground color.
   */
  blueBright: TerminalStyle
  /**
   * Formats text with bold intensity.
   */
  bold: TerminalStyle
  /**
   * Formats text with cyan foreground color.
   */
  cyan: TerminalStyle
  /**
   * Formats text with bright cyan foreground color.
   */
  cyanBright: TerminalStyle
  /**
   * Formats text with dim intensity.
   */
  dim: TerminalStyle
  /**
   * Formats text with one or more named terminal styles.
   *
   * @param value Text to format.
   * @param styles Style names to apply, from outermost to innermost.
   * @returns Formatted text, or the original text when styles are disabled.
   */
  format(value: string, ...styles: TerminalStyleName[]): string
  /**
   * Formats text with gray foreground color.
   */
  gray: TerminalStyle
  /**
   * Formats text with green foreground color.
   */
  green: TerminalStyle
  /**
   * Formats text with bright green foreground color.
   */
  greenBright: TerminalStyle
  /**
   * Formats text with grey foreground color.
   */
  grey: TerminalStyle
  /**
   * Formats text as hidden.
   */
  hidden: TerminalStyle
  /**
   * Formats text with inverted foreground and background colors.
   */
  inverse: TerminalStyle
  /**
   * Formats text with italic styling.
   */
  italic: TerminalStyle
  /**
   * Formats text with magenta foreground color.
   */
  magenta: TerminalStyle
  /**
   * Formats text with bright magenta foreground color.
   */
  magentaBright: TerminalStyle
  /**
   * Formats text with an overline.
   */
  overline: TerminalStyle
  /**
   * Formats text with red foreground color.
   */
  red: TerminalStyle
  /**
   * Formats text with bright red foreground color.
   */
  redBright: TerminalStyle
  /**
   * Formats text with a strikethrough.
   */
  strikethrough: TerminalStyle
  /**
   * Formats text with an underline.
   */
  underline: TerminalStyle
  /**
   * Formats text with white foreground color.
   */
  white: TerminalStyle
  /**
   * Formats text with bright white foreground color.
   */
  whiteBright: TerminalStyle
  /**
   * Formats text with yellow foreground color.
   */
  yellow: TerminalStyle
  /**
   * Formats text with bright yellow foreground color.
   */
  yellowBright: TerminalStyle
}

/**
 * Options used to create a terminal abstraction.
 */
export interface TerminalOptions extends UseColorOptions {
  /**
   * Input stream used to detect whether the terminal is interactive (defaults to `process.stdin`).
   */
  stdin?: TerminalInputStream
  /**
   * Output stream used for normal output (defaults to `process.stdout`).
   */
  stdout?: TerminalOutputStream
  /**
   * Output stream used for error output (defaults to `process.stderr`).
   */
  stderr?: TerminalOutputStream
}

/**
 * Testable abstraction around terminal input, output, styles, and controls.
 */
export interface Terminal {
  /**
   * Environment variables used by this terminal.
   */
  readonly env: TerminalEnvironment
  /**
   * Output stream used for error output.
   */
  readonly stderr: TerminalOutputStream
  /**
   * Input stream used for interactivity detection.
   */
  readonly stdin: TerminalInputStream
  /**
   * Output stream used for normal output.
   */
  readonly stdout: TerminalOutputStream
  /**
   * Style helpers configured for this terminal's output stream.
   */
  readonly styles: TerminalStyles
  /**
   * Current output column count, when known.
   */
  readonly columns: number | undefined
  /**
   * Current output row count, when known.
   */
  readonly rows: number | undefined
  /**
   * Whether both input and output streams are attached to TTYs.
   */
  readonly isInteractive: boolean
  /**
   * Whether the output stream is attached to a TTY.
   */
  readonly isTTY: boolean
  /**
   * Clears the current output line.
   */
  clearLine(): void
  /**
   * Moves the output cursor to a zero-based column and optional row.
   *
   * @param column Zero-based output column.
   * @param row Optional zero-based output row.
   */
  cursorTo(column: number, row?: number): void
  /**
   * Erases output from the cursor through the end of the terminal.
   */
  eraseDown(): void
  /**
   * Writes a value to the error output stream.
   *
   * @param value Text to write.
   */
  error(value: string): void
  /**
   * Writes a value and trailing newline to the error output stream.
   *
   * @param value Text to write (defaults to an empty string).
   */
  errorLine(value?: string): void
  /**
   * Hides the terminal cursor.
   */
  hideCursor(): void
  /**
   * Moves the output cursor by relative column and row offsets.
   *
   * @param columns Relative column offset.
   * @param rows Relative row offset.
   */
  moveCursor(columns: number, rows: number): void
  /**
   * Shows the terminal cursor.
   */
  showCursor(): void
  /**
   * Writes a value to the normal output stream.
   *
   * @param value Text to write.
   */
  write(value: string): void
  /**
   * Writes a value and trailing newline to the normal output stream.
   *
   * @param value Text to write (defaults to an empty string).
   */
  writeLine(value?: string): void
}

/**
 * Raw ANSI escape sequences and helpers for terminal controls.
 */
export const ansi = {
  /**
   * Resets all ANSI styles.
   */
  reset: ansiResetCode,
  ...ansiStyleCodes,
  /**
   * Clears the current terminal line.
   */
  clearLine: '\x1b[2K',
  /**
   * Erases from the cursor through the end of the terminal.
   */
  eraseDown: '\x1b[J',
  /**
   * Hides the terminal cursor.
   */
  hideCursor: '\x1b[?25l',
  /**
   * Shows the terminal cursor.
   */
  showCursor: '\x1b[?25h',
  /**
   * Creates an ANSI sequence that moves the cursor to a zero-based column and optional row.
   *
   * @param column Zero-based output column.
   * @param row Optional zero-based output row.
   * @returns ANSI cursor position sequence.
   */
  cursorTo(column: number, row?: number): string {
    let normalizedColumn = normalizePosition(column) + 1

    if (row === undefined) {
      return `\x1b[${normalizedColumn}G`
    }

    let normalizedRow = normalizePosition(row) + 1
    return `\x1b[${normalizedRow};${normalizedColumn}H`
  },
  /**
   * Creates an ANSI sequence that moves the cursor by relative column and row offsets.
   *
   * @param columns Relative column offset.
   * @param rows Relative row offset.
   * @returns ANSI cursor movement sequence.
   */
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
