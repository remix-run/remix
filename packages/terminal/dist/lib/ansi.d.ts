/**
 * Names of ANSI text modifier styles supported by terminal style helpers.
 */
export type TerminalModifierName = 'bold' | 'dim' | 'inverse' | 'italic' | 'overline' | 'strikethrough' | 'underline';
/**
 * Names of ANSI foreground color styles supported by terminal style helpers.
 */
export type TerminalForegroundColorName = 'black' | 'blackBright' | 'blue' | 'blueBright' | 'cyan' | 'cyanBright' | 'gray' | 'green' | 'greenBright' | 'grey' | 'magenta' | 'magentaBright' | 'red' | 'redBright' | 'white' | 'whiteBright' | 'yellow' | 'yellowBright';
/**
 * Names of ANSI background color styles supported by terminal style helpers.
 */
export type TerminalBackgroundColorName = 'bgBlack' | 'bgBlackBright' | 'bgBlue' | 'bgBlueBright' | 'bgCyan' | 'bgCyanBright' | 'bgGray' | 'bgGreen' | 'bgGreenBright' | 'bgGrey' | 'bgMagenta' | 'bgMagentaBright' | 'bgRed' | 'bgRedBright' | 'bgWhite' | 'bgWhiteBright' | 'bgYellow' | 'bgYellowBright';
/**
 * Any named terminal style supported by `createStyles()`.
 */
export type TerminalStyleName = TerminalModifierName | TerminalForegroundColorName | TerminalBackgroundColorName;
export type AnsiStyleCodes = Record<TerminalStyleName, string>;
export interface Ansi extends AnsiStyleCodes {
    reset: string;
    clearLine: string;
    eraseDown: string;
    hideCursor: string;
    showCursor: string;
    cursorTo(column: number, row?: number): string;
    moveCursor(columns: number, rows: number): string;
}
/**
 * ANSI reset sequence that clears all active styles.
 */
export declare const ansiResetCode = "\u001B[0m";
export declare const ansiStyleCodes: AnsiStyleCodes;
/**
 * Raw ANSI escape sequences and helpers for terminal controls.
 */
export declare const ansi: Ansi;
/**
 * Removes ANSI escape sequences from a string.
 *
 * @param value The string to strip
 * @returns The string without ANSI escape sequences
 */
export declare function stripAnsi(value: string): string;
//# sourceMappingURL=ansi.d.ts.map