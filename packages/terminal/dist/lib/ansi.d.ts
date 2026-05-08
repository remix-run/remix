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
/**
 * ANSI reset sequence that clears all active styles.
 */
export declare const ansiResetCode = "\u001B[0m";
export declare const ansiStyleCodes: {
    bold: string;
    dim: string;
    italic: string;
    underline: string;
    inverse: string;
    strikethrough: string;
    overline: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    blackBright: string;
    gray: string;
    grey: string;
    redBright: string;
    greenBright: string;
    yellowBright: string;
    blueBright: string;
    magentaBright: string;
    cyanBright: string;
    whiteBright: string;
    bgBlack: string;
    bgRed: string;
    bgGreen: string;
    bgYellow: string;
    bgBlue: string;
    bgMagenta: string;
    bgCyan: string;
    bgWhite: string;
    bgBlackBright: string;
    bgGray: string;
    bgGrey: string;
    bgRedBright: string;
    bgGreenBright: string;
    bgYellowBright: string;
    bgBlueBright: string;
    bgMagentaBright: string;
    bgCyanBright: string;
    bgWhiteBright: string;
};
/**
 * Raw ANSI escape sequences and helpers for terminal controls.
 */
export declare const ansi: {
    bold: string;
    dim: string;
    italic: string;
    underline: string;
    inverse: string;
    strikethrough: string;
    overline: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    blackBright: string;
    gray: string;
    grey: string;
    redBright: string;
    greenBright: string;
    yellowBright: string;
    blueBright: string;
    magentaBright: string;
    cyanBright: string;
    whiteBright: string;
    bgBlack: string;
    bgRed: string;
    bgGreen: string;
    bgYellow: string;
    bgBlue: string;
    bgMagenta: string;
    bgCyan: string;
    bgWhite: string;
    bgBlackBright: string;
    bgGray: string;
    bgGrey: string;
    bgRedBright: string;
    bgGreenBright: string;
    bgYellowBright: string;
    bgBlueBright: string;
    bgMagentaBright: string;
    bgCyanBright: string;
    bgWhiteBright: string;
    /**
     * Resets all ANSI styles.
     */
    reset: string;
    /**
     * Clears the current terminal line.
     */
    clearLine: string;
    /**
     * Erases from the cursor through the end of the terminal.
     */
    eraseDown: string;
    /**
     * Hides the terminal cursor.
     */
    hideCursor: string;
    /**
     * Shows the terminal cursor.
     */
    showCursor: string;
    /**
     * Creates an ANSI sequence that moves the cursor to a zero-based column and optional row.
     *
     * @param column Zero-based output column.
     * @param row Optional zero-based output row.
     * @returns ANSI cursor position sequence.
     */
    cursorTo(column: number, row?: number | undefined): string;
    /**
     * Creates an ANSI sequence that moves the cursor by relative column and row offsets.
     *
     * @param columns Relative column offset.
     * @param rows Relative row offset.
     * @returns ANSI cursor movement sequence.
     */
    moveCursor(columns: number, rows: number): string;
};
/**
 * Removes ANSI escape sequences from a string.
 *
 * @param value The string to strip
 * @returns The string without ANSI escape sequences
 */
export declare function stripAnsi(value: string): string;
//# sourceMappingURL=ansi.d.ts.map