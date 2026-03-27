import * as process from 'node:process'

const ANSI_RESET = '\u001B[0m'
const ANSI_BOLD = '\u001B[1m'
const ANSI_LIGHT_RED = '\u001B[91m'
const ANSI_LIGHT_YELLOW = '\u001B[93m'

let colorDisabledByFlag = false

export function configureColors(options: { disabled: boolean }): void {
  colorDisabledByFlag = options.disabled
}

export function bold(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return paint(text, ANSI_BOLD, target)
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

export function restoreTerminalFormatting(): void {
  if (supportsAnsi(process.stdout)) {
    process.stdout.write(ANSI_RESET)
    return
  }

  if (supportsAnsi(process.stderr)) {
    process.stderr.write(ANSI_RESET)
  }
}

function paint(text: string, colorCode: string, target: NodeJS.WriteStream): string {
  return isColorDisabled(target) ? text : `${colorCode}${text}${ANSI_RESET}`
}

function isColorDisabled(target: NodeJS.WriteStream): boolean {
  return colorDisabledByFlag || process.env.NO_COLOR != null || !supportsAnsi(target)
}

function supportsAnsi(target: NodeJS.WriteStream): boolean {
  return process.env.TERM !== 'dumb' && target.isTTY
}
