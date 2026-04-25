export interface StyleCode {
  readonly open: string
  readonly close: string
}

/**
 * Names of ANSI text modifier styles supported by terminal style helpers.
 */
export type TerminalModifierName =
  | 'bold'
  | 'dim'
  | 'hidden'
  | 'inverse'
  | 'italic'
  | 'overline'
  | 'strikethrough'
  | 'underline'

/**
 * Names of ANSI foreground color styles supported by terminal style helpers.
 */
export type TerminalForegroundColorName =
  | 'black'
  | 'blackBright'
  | 'blue'
  | 'blueBright'
  | 'cyan'
  | 'cyanBright'
  | 'gray'
  | 'green'
  | 'greenBright'
  | 'grey'
  | 'magenta'
  | 'magentaBright'
  | 'red'
  | 'redBright'
  | 'white'
  | 'whiteBright'
  | 'yellow'
  | 'yellowBright'

/**
 * Names of ANSI background color styles supported by terminal style helpers.
 */
export type TerminalBackgroundColorName =
  | 'bgBlack'
  | 'bgBlackBright'
  | 'bgBlue'
  | 'bgBlueBright'
  | 'bgCyan'
  | 'bgCyanBright'
  | 'bgGray'
  | 'bgGreen'
  | 'bgGreenBright'
  | 'bgGrey'
  | 'bgMagenta'
  | 'bgMagentaBright'
  | 'bgRed'
  | 'bgRedBright'
  | 'bgWhite'
  | 'bgWhiteBright'
  | 'bgYellow'
  | 'bgYellowBright'

/**
 * Any named terminal style supported by `createStyles()`.
 */
export type TerminalStyleName =
  | TerminalModifierName
  | TerminalForegroundColorName
  | TerminalBackgroundColorName

/**
 * Function that formats text with a terminal style.
 *
 * @param value Text to format.
 * @returns Formatted text, or the original text when styles are disabled.
 */
export type TerminalStyle = (value: string) => string

export const ansiResetCode = '\x1b[0m'

const close = {
  backgroundColor: '\x1b[49m',
  foregroundColor: '\x1b[39m',
  hidden: '\x1b[28m',
  intensity: '\x1b[22m',
  inverse: '\x1b[27m',
  italic: '\x1b[23m',
  overline: '\x1b[55m',
  strikethrough: '\x1b[29m',
  underline: '\x1b[24m',
}

export const ansiStyleCodes = {
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  inverse: '\x1b[7m',
  hidden: '\x1b[8m',
  strikethrough: '\x1b[9m',
  overline: '\x1b[53m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  blackBright: '\x1b[90m',
  gray: '\x1b[90m',
  grey: '\x1b[90m',
  redBright: '\x1b[91m',
  greenBright: '\x1b[92m',
  yellowBright: '\x1b[93m',
  blueBright: '\x1b[94m',
  magentaBright: '\x1b[95m',
  cyanBright: '\x1b[96m',
  whiteBright: '\x1b[97m',
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
  bgBlackBright: '\x1b[100m',
  bgGray: '\x1b[100m',
  bgGrey: '\x1b[100m',
  bgRedBright: '\x1b[101m',
  bgGreenBright: '\x1b[102m',
  bgYellowBright: '\x1b[103m',
  bgBlueBright: '\x1b[104m',
  bgMagentaBright: '\x1b[105m',
  bgCyanBright: '\x1b[106m',
  bgWhiteBright: '\x1b[107m',
} satisfies Record<TerminalStyleName, string>

export const styleCodes: Record<TerminalStyleName, StyleCode> = {
  bold: { open: ansiStyleCodes.bold, close: close.intensity },
  dim: { open: ansiStyleCodes.dim, close: close.intensity },
  hidden: { open: ansiStyleCodes.hidden, close: close.hidden },
  inverse: { open: ansiStyleCodes.inverse, close: close.inverse },
  italic: { open: ansiStyleCodes.italic, close: close.italic },
  overline: { open: ansiStyleCodes.overline, close: close.overline },
  strikethrough: { open: ansiStyleCodes.strikethrough, close: close.strikethrough },
  underline: { open: ansiStyleCodes.underline, close: close.underline },
  black: { open: ansiStyleCodes.black, close: close.foregroundColor },
  blackBright: { open: ansiStyleCodes.blackBright, close: close.foregroundColor },
  blue: { open: ansiStyleCodes.blue, close: close.foregroundColor },
  blueBright: { open: ansiStyleCodes.blueBright, close: close.foregroundColor },
  cyan: { open: ansiStyleCodes.cyan, close: close.foregroundColor },
  cyanBright: { open: ansiStyleCodes.cyanBright, close: close.foregroundColor },
  gray: { open: ansiStyleCodes.gray, close: close.foregroundColor },
  green: { open: ansiStyleCodes.green, close: close.foregroundColor },
  greenBright: { open: ansiStyleCodes.greenBright, close: close.foregroundColor },
  grey: { open: ansiStyleCodes.grey, close: close.foregroundColor },
  magenta: { open: ansiStyleCodes.magenta, close: close.foregroundColor },
  magentaBright: { open: ansiStyleCodes.magentaBright, close: close.foregroundColor },
  red: { open: ansiStyleCodes.red, close: close.foregroundColor },
  redBright: { open: ansiStyleCodes.redBright, close: close.foregroundColor },
  white: { open: ansiStyleCodes.white, close: close.foregroundColor },
  whiteBright: { open: ansiStyleCodes.whiteBright, close: close.foregroundColor },
  yellow: { open: ansiStyleCodes.yellow, close: close.foregroundColor },
  yellowBright: { open: ansiStyleCodes.yellowBright, close: close.foregroundColor },
  bgBlack: { open: ansiStyleCodes.bgBlack, close: close.backgroundColor },
  bgBlackBright: { open: ansiStyleCodes.bgBlackBright, close: close.backgroundColor },
  bgBlue: { open: ansiStyleCodes.bgBlue, close: close.backgroundColor },
  bgBlueBright: { open: ansiStyleCodes.bgBlueBright, close: close.backgroundColor },
  bgCyan: { open: ansiStyleCodes.bgCyan, close: close.backgroundColor },
  bgCyanBright: { open: ansiStyleCodes.bgCyanBright, close: close.backgroundColor },
  bgGray: { open: ansiStyleCodes.bgGray, close: close.backgroundColor },
  bgGreen: { open: ansiStyleCodes.bgGreen, close: close.backgroundColor },
  bgGreenBright: { open: ansiStyleCodes.bgGreenBright, close: close.backgroundColor },
  bgGrey: { open: ansiStyleCodes.bgGrey, close: close.backgroundColor },
  bgMagenta: { open: ansiStyleCodes.bgMagenta, close: close.backgroundColor },
  bgMagentaBright: { open: ansiStyleCodes.bgMagentaBright, close: close.backgroundColor },
  bgRed: { open: ansiStyleCodes.bgRed, close: close.backgroundColor },
  bgRedBright: { open: ansiStyleCodes.bgRedBright, close: close.backgroundColor },
  bgWhite: { open: ansiStyleCodes.bgWhite, close: close.backgroundColor },
  bgWhiteBright: { open: ansiStyleCodes.bgWhiteBright, close: close.backgroundColor },
  bgYellow: { open: ansiStyleCodes.bgYellow, close: close.backgroundColor },
  bgYellowBright: { open: ansiStyleCodes.bgYellowBright, close: close.backgroundColor },
}

export function createStyleFormatter(enabled: boolean): {
  createStyle(style: TerminalStyleName): TerminalStyle
  format(value: string, ...styles: TerminalStyleName[]): string
} {
  let format = enabled ? formatStyles : passthrough

  return {
    createStyle(style) {
      return (value) => format(value, style)
    },
    format,
  }
}

export function formatStyles(value: string, ...styles: TerminalStyleName[]): string {
  if (styles.length === 0) {
    return value
  }

  let result = value

  for (let i = styles.length - 1; i >= 0; i--) {
    result = applyStyle(result, styleCodes[styles[i]])
  }

  return result
}

function passthrough(value: string): string {
  return value
}

function applyStyle(value: string, code: StyleCode): string {
  let restored = value
    .replaceAll(code.close, code.close + code.open)
    .replaceAll(ansiResetCode, ansiResetCode + code.open)

  return `${code.open}${restored}${code.close}`
}
