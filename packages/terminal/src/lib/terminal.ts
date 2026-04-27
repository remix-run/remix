import {
  getDefaultEnvironment,
  type TerminalEnvironment,
  type UseColorOptions,
} from './color-support.ts'
import { ansiResetCode, ansiStyleCodes, createStyles, type TerminalStyles } from './styles.ts'

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
 * Output stream shape used for terminal writes and TTY detection.
 */
export interface TerminalOutputStream {
  /**
   * Whether the output stream is attached to a TTY.
   */
  readonly isTTY?: boolean
  /**
   * Writes a chunk of text to the output stream.
   *
   * @param chunk Text chunk to write.
   * @returns Stream-specific write result.
   */
  write(chunk: string): unknown
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

function getDefaultStdin(): TerminalInputStream {
  return typeof process === 'undefined' ? noopInputStream : process.stdin
}

function getDefaultStdout(): TerminalOutputStream {
  return typeof process === 'undefined' ? noopOutputStream : process.stdout
}

function getDefaultStderr(): TerminalOutputStream {
  return typeof process === 'undefined' ? noopOutputStream : process.stderr
}
