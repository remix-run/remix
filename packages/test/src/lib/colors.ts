import { createStyles } from '@remix-run/terminal'

const terminalStyles = createStyles()

export const colors = {
  reset: terminalStyles.reset,
  dim: terminalStyles.dim,
  green: terminalStyles.green,
  red: terminalStyles.red,
  cyan: terminalStyles.cyan,
  yellow(value: string): string {
    return terminalStyles.format(value, 'dim', 'yellow')
  },
}
