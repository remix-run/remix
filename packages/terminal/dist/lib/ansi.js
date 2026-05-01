/**
 * ANSI reset sequence that clears all active styles.
 */
export const ansiResetCode = '\x1b[0m';
export const ansiStyleCodes = {
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    italic: '\x1b[3m',
    underline: '\x1b[4m',
    inverse: '\x1b[7m',
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
};
/**
 * Raw ANSI escape sequences and helpers for terminal controls.
 */
export const ansi = {
    /**
     * Resets all ANSI styles.
     */
    reset: ansiResetCode,
    ...ansiStyleCodes,
    /**
     * Clears the current terminal line.
     */
    clearLine: '\x1b[2K',
    /**
     * Erases from the cursor through the end of the terminal.
     */
    eraseDown: '\x1b[J',
    /**
     * Hides the terminal cursor.
     */
    hideCursor: '\x1b[?25l',
    /**
     * Shows the terminal cursor.
     */
    showCursor: '\x1b[?25h',
    /**
     * Creates an ANSI sequence that moves the cursor to a zero-based column and optional row.
     *
     * @param column Zero-based output column.
     * @param row Optional zero-based output row.
     * @returns ANSI cursor position sequence.
     */
    cursorTo(column, row) {
        let normalizedColumn = normalizePosition(column) + 1;
        if (row === undefined) {
            return `\x1b[${normalizedColumn}G`;
        }
        let normalizedRow = normalizePosition(row) + 1;
        return `\x1b[${normalizedRow};${normalizedColumn}H`;
    },
    /**
     * Creates an ANSI sequence that moves the cursor by relative column and row offsets.
     *
     * @param columns Relative column offset.
     * @param rows Relative row offset.
     * @returns ANSI cursor movement sequence.
     */
    moveCursor(columns, rows) {
        let horizontal = normalizeOffset(columns);
        let vertical = normalizeOffset(rows);
        let sequence = '';
        if (horizontal > 0) {
            sequence += `\x1b[${horizontal}C`;
        }
        else if (horizontal < 0) {
            sequence += `\x1b[${Math.abs(horizontal)}D`;
        }
        if (vertical > 0) {
            sequence += `\x1b[${vertical}B`;
        }
        else if (vertical < 0) {
            sequence += `\x1b[${Math.abs(vertical)}A`;
        }
        return sequence;
    },
};
const escapeCharacter = String.fromCharCode(27);
const bellCharacter = String.fromCharCode(7);
const ansiPattern = new RegExp(`(?:${escapeCharacter}\\][\\s\\S]*?(?:${bellCharacter}|${escapeCharacter}\\\\))` +
    `|${escapeCharacter}\\[[0-?]*[ -/]*[@-~]`, 'g');
/**
 * Removes ANSI escape sequences from a string.
 *
 * @param value The string to strip
 * @returns The string without ANSI escape sequences
 */
export function stripAnsi(value) {
    return value.replace(ansiPattern, '');
}
function normalizePosition(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.trunc(value));
}
function normalizeOffset(value) {
    return Number.isFinite(value) ? Math.trunc(value) : 0;
}
