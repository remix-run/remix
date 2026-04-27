export { shouldUseColors } from './lib/color-support.ts'
export type { TerminalEnvironment, UseColorOptions } from './lib/color-support.ts'
export { createStyles } from './lib/styles.ts'
export { ansi, createTerminal, stripAnsi } from './lib/terminal.ts'
export type {
  Terminal,
  TerminalInputStream,
  TerminalOptions,
  TerminalOutputStream,
} from './lib/terminal.ts'
export type {
  TerminalBackgroundColorName,
  TerminalForegroundColorName,
  TerminalModifierName,
  TerminalStyle,
  TerminalStyleName,
  TerminalStyles,
} from './lib/styles.ts'
