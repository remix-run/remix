import * as process from 'node:process'

import { ansi, createTerminal, shouldUseColors } from '@remix-run/terminal'

let colorDisabledByFlag = false

export function configureColors(options: { disabled: boolean }): void {
  colorDisabledByFlag = options.disabled
}

export function bold(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return paint(text, ansi.bold, target)
}

export function lightGreen(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return paint(text, ansi.greenBright, target)
}

export function lightBlue(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return paint(text, ansi.blueBright, target)
}

export function boldLightBlue(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return isColorDisabled(target) ? text : `${ansi.bold}${ansi.blueBright}${text}${ansi.reset}`
}

export function lightGray(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return paint(text, ansi.gray, target)
}

export function lightMagenta(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return paint(text, ansi.magentaBright, target)
}

export function lightRed(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return paint(text, ansi.redBright, target)
}

export function lightYellow(text: string, target: NodeJS.WriteStream = process.stdout): string {
  return paint(text, ansi.yellowBright, target)
}

export function reset(target: NodeJS.WriteStream): string {
  return isColorDisabled(target) ? '' : ansi.reset
}

export function remixWordmark(target: NodeJS.WriteStream = process.stdout): string {
  if (isColorDisabled(target)) {
    return 'REMIX'
  }

  return [
    paint('R', ansi.blueBright, target),
    paint('E', ansi.greenBright, target),
    paint('M', ansi.yellowBright, target),
    paint('I', ansi.magentaBright, target),
    paint('X', ansi.redBright, target),
  ].join('')
}

export function clearCurrentLine(): string {
  return `\r${ansi.clearLine}`
}

export function restoreTerminalFormatting(): void {
  if (canUseAnsi(process.stdout)) {
    createTerminal({ stdout: process.stdout }).write(ansi.reset)
    return
  }

  if (canUseAnsi(process.stderr)) {
    createTerminal({ stderr: process.stderr }).error(ansi.reset)
  }
}

function paint(text: string, colorCode: string, target: NodeJS.WriteStream): string {
  return isColorDisabled(target) ? text : `${colorCode}${text}${ansi.reset}`
}

function isColorDisabled(target: NodeJS.WriteStream): boolean {
  return colorDisabledByFlag || !shouldUseColors({ stream: target })
}

export function canUseAnsi(target: NodeJS.WriteStream): boolean {
  return process.env.TERM !== 'dumb' && target.isTTY === true
}
