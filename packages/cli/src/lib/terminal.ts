import * as process from 'node:process'

const ANSI_RESET = '\u001B[0m'
const ANSI_BOLD = '\u001B[1m'
const ANSI_LIGHT_BLUE = '\u001B[94m'
const ANSI_LIGHT_GREEN = '\u001B[92m'
const ANSI_LIGHT_GRAY = '\u001B[90m'
const ANSI_LIGHT_MAGENTA = '\u001B[95m'
const ANSI_LIGHT_RED = '\u001B[91m'
const ANSI_LIGHT_YELLOW = '\u001B[93m'

let colorDisabledByFlag = false

export function configureColors(options: { disabled: boolean }): void {
  colorDisabledByFlag = options.disabled
}

export function bold(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return paint(text, ANSI_BOLD, target)
}

export function lightGreen(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return paint(text, ANSI_LIGHT_GREEN, target)
}

export function lightBlue(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return paint(text, ANSI_LIGHT_BLUE, target)
}

export function lightGray(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return paint(text, ANSI_LIGHT_GRAY, target)
}

export function lightMagenta(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return paint(text, ANSI_LIGHT_MAGENTA, target)
}

export function lightRed(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return paint(text, ANSI_LIGHT_RED, target)
}

export function lightYellow(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return paint(text, ANSI_LIGHT_YELLOW, target)
}

export function reset(target: NodeJS.WriteStream): string {
  return isColorDisabled(target) ? '' : ANSI_RESET
}

export function remixWordmark(target: NodeJS.WriteStream = process.stdout): string {
  if (isColorDisabled(target)) {
    return 'Remix'
  }

  return [
    paint('R', ANSI_LIGHT_BLUE, target),
    paint('e', ANSI_LIGHT_GREEN, target),
    paint('m', ANSI_LIGHT_YELLOW, target),
    paint('i', ANSI_LIGHT_MAGENTA, target),
    paint('x', ANSI_LIGHT_RED, target),
  ].join('')
}

export function writeCommandPreamble(): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\n')
    return
  }

  if (process.stderr.isTTY) {
    process.stderr.write('\n')
  }
}

export function writeCommandEpilogue(): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\n')
    return
  }

  if (process.stderr.isTTY) {
    process.stderr.write('\n')
  }
}

export function restoreTerminalFormatting(): void {
  if (canUseAnsi(process.stdout)) {
    process.stdout.write(ANSI_RESET)
    return
  }

  if (canUseAnsi(process.stderr)) {
    process.stderr.write(ANSI_RESET)
  }
}

function paint(text: string, colorCode: string, target: NodeJS.WriteStream): string {
  return isColorDisabled(target) ? text : `${colorCode}${text}${ANSI_RESET}`
}

function isColorDisabled(target: NodeJS.WriteStream): boolean {
  return colorDisabledByFlag || process.env.NO_COLOR != null || !canUseAnsi(target)
}

export function canUseAnsi(target: NodeJS.WriteStream): boolean {
  return process.env.TERM !== 'dumb' && target.isTTY
}
