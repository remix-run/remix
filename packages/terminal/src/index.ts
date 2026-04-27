export { ansi, stripAnsi } from './lib/ansi.ts'
export type {
  TerminalBackgroundColorName,
  TerminalForegroundColorName,
  TerminalModifierName,
  TerminalStyleName,
} from './lib/ansi.ts'

export { shouldUseColors } from './lib/color-support.ts'
export type { TerminalEnvironment, UseColorOptions } from './lib/color-support.ts'

export { createStyles } from './lib/styles.ts'
export type { TerminalStyle, TerminalStyles } from './lib/styles.ts'

export { createTerminal } from './lib/terminal.ts'
export type {
  Terminal,
  TerminalInputStream,
  TerminalOptions,
  TerminalOutputStream,
} from './lib/terminal.ts'
