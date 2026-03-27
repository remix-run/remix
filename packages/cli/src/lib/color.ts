import * as process from 'node:process'

const ANSI_RESET = '\u001B[0m'
const ANSI_LIGHT_GRAY = '\u001B[90m'
const ANSI_LIGHT_RED = '\u001B[91m'
const ANSI_LIGHT_YELLOW = '\u001B[93m'

type ColorTarget = 'stderr' | 'stdout'

let colorDisabledByFlag = false

export function configureColors(options: { disabled: boolean }): void {
  colorDisabledByFlag = options.disabled
}

export function lightGray(text: string, target: ColorTarget = 'stdout'): string {
  return paint(text, ANSI_LIGHT_GRAY, target)
}

export function lightRed(text: string, target: ColorTarget = 'stdout'): string {
  return paint(text, ANSI_LIGHT_RED, target)
}

export function lightYellow(text: string, target: ColorTarget = 'stdout'): string {
  return paint(text, ANSI_LIGHT_YELLOW, target)
}

export function reset(target: ColorTarget = 'stdout'): string {
  return isColorDisabled(target) ? '' : ANSI_RESET
}

function paint(text: string, colorCode: string, target: ColorTarget): string {
  if (isColorDisabled(target)) {
    return text
  }

  return `${colorCode}${text}${ANSI_RESET}`
}

function isColorDisabled(target: ColorTarget): boolean {
  return (
    colorDisabledByFlag ||
    process.env.NO_COLOR != null ||
    process.env.TERM === 'dumb' ||
    !getStream(target).isTTY
  )
}

function getStream(target: ColorTarget): NodeJS.WriteStream {
  return target === 'stderr' ? process.stderr : process.stdout
}
