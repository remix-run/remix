import * as process from 'node:process'

const ANSI_RESET = '\u001B[0m'
const ANSI_LIGHT_GRAY = '\u001B[90m'
const ANSI_LIGHT_RED = '\u001B[91m'
const ANSI_LIGHT_YELLOW = '\u001B[93m'

export function lightGray(text: string): string {
  return paint(text, ANSI_LIGHT_GRAY)
}

export function lightRed(text: string): string {
  return paint(text, ANSI_LIGHT_RED)
}

export function lightYellow(text: string): string {
  return paint(text, ANSI_LIGHT_YELLOW)
}

export function reset(): string {
  return isColorDisabled() ? '' : ANSI_RESET
}

function paint(text: string, colorCode: string): string {
  if (isColorDisabled()) {
    return text
  }

  return `${colorCode}${text}${ANSI_RESET}`
}

function isColorDisabled(): boolean {
  return process.env.NO_COLOR != null
}
