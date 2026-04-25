export {
  ansi,
  createStyles,
  createTerminal,
  shouldUseColors,
  stripAnsi,
  type Terminal,
  type TerminalEnvironment,
  type TerminalInputStream,
  type TerminalOptions,
  type TerminalOutputStream,
  type TerminalStyles,
  type UseColorOptions,
} from './lib/terminal.ts'

export type {
  TerminalBackgroundColorName,
  TerminalForegroundColorName,
  TerminalModifierName,
  TerminalStyle,
  TerminalStyleName,
} from './lib/styles.ts'
