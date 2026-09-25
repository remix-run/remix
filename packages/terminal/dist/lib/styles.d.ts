import { type TerminalStyleName } from './ansi.ts';
import { type ColorSupportOptions } from './env.ts';
/**
 * Function that formats text with a terminal style.
 *
 * @param value Text to format.
 * @returns Formatted text, or the original text when styles are disabled.
 */
export type TerminalStyle = (value: string) => string;
/**
 * Style helpers returned by `createStyles()` and `createTerminal()`.
 */
export interface TerminalStyles {
    /**
     * Whether style helpers emit ANSI escape sequences.
     */
    readonly enabled: boolean;
    /**
     * ANSI reset sequence when styles are enabled, otherwise an empty string.
     */
    readonly reset: string;
    /**
     * Formats text with a black background.
     */
    bgBlack: TerminalStyle;
    /**
     * Formats text with a bright black background.
     */
    bgBlackBright: TerminalStyle;
    /**
     * Formats text with a blue background.
     */
    bgBlue: TerminalStyle;
    /**
     * Formats text with a bright blue background.
     */
    bgBlueBright: TerminalStyle;
    /**
     * Formats text with a cyan background.
     */
    bgCyan: TerminalStyle;
    /**
     * Formats text with a bright cyan background.
     */
    bgCyanBright: TerminalStyle;
    /**
     * Formats text with a gray background.
     */
    bgGray: TerminalStyle;
    /**
     * Formats text with a green background.
     */
    bgGreen: TerminalStyle;
    /**
     * Formats text with a bright green background.
     */
    bgGreenBright: TerminalStyle;
    /**
     * Formats text with a grey background.
     */
    bgGrey: TerminalStyle;
    /**
     * Formats text with a magenta background.
     */
    bgMagenta: TerminalStyle;
    /**
     * Formats text with a bright magenta background.
     */
    bgMagentaBright: TerminalStyle;
    /**
     * Formats text with a red background.
     */
    bgRed: TerminalStyle;
    /**
     * Formats text with a bright red background.
     */
    bgRedBright: TerminalStyle;
    /**
     * Formats text with a white background.
     */
    bgWhite: TerminalStyle;
    /**
     * Formats text with a bright white background.
     */
    bgWhiteBright: TerminalStyle;
    /**
     * Formats text with a yellow background.
     */
    bgYellow: TerminalStyle;
    /**
     * Formats text with a bright yellow background.
     */
    bgYellowBright: TerminalStyle;
    /**
     * Formats text with black foreground color.
     */
    black: TerminalStyle;
    /**
     * Formats text with bright black foreground color.
     */
    blackBright: TerminalStyle;
    /**
     * Formats text with blue foreground color.
     */
    blue: TerminalStyle;
    /**
     * Formats text with bright blue foreground color.
     */
    blueBright: TerminalStyle;
    /**
     * Formats text with bold intensity.
     */
    bold: TerminalStyle;
    /**
     * Formats text with cyan foreground color.
     */
    cyan: TerminalStyle;
    /**
     * Formats text with bright cyan foreground color.
     */
    cyanBright: TerminalStyle;
    /**
     * Formats text with dim intensity.
     */
    dim: TerminalStyle;
    /**
     * Formats text with one or more named terminal styles.
     *
     * @param value Text to format.
     * @param styles Style names to apply, from outermost to innermost.
     * @returns Formatted text, or the original text when styles are disabled.
     */
    format(value: string, ...styles: TerminalStyleName[]): string;
    /**
     * Formats text with gray foreground color.
     */
    gray: TerminalStyle;
    /**
     * Formats text with green foreground color.
     */
    green: TerminalStyle;
    /**
     * Formats text with bright green foreground color.
     */
    greenBright: TerminalStyle;
    /**
     * Formats text with grey foreground color.
     */
    grey: TerminalStyle;
    /**
     * Formats text with inverted foreground and background colors.
     */
    inverse: TerminalStyle;
    /**
     * Formats text with italic styling.
     */
    italic: TerminalStyle;
    /**
     * Formats text with magenta foreground color.
     */
    magenta: TerminalStyle;
    /**
     * Formats text with bright magenta foreground color.
     */
    magentaBright: TerminalStyle;
    /**
     * Formats text with an overline.
     */
    overline: TerminalStyle;
    /**
     * Formats text with red foreground color.
     */
    red: TerminalStyle;
    /**
     * Formats text with bright red foreground color.
     */
    redBright: TerminalStyle;
    /**
     * Formats text with a strikethrough.
     */
    strikethrough: TerminalStyle;
    /**
     * Formats text with an underline.
     */
    underline: TerminalStyle;
    /**
     * Formats text with white foreground color.
     */
    white: TerminalStyle;
    /**
     * Formats text with bright white foreground color.
     */
    whiteBright: TerminalStyle;
    /**
     * Formats text with yellow foreground color.
     */
    yellow: TerminalStyle;
    /**
     * Formats text with bright yellow foreground color.
     */
    yellowBright: TerminalStyle;
}
/**
 * Options used to create terminal style helpers.
 */
export interface CreateStylesOptions extends ColorSupportOptions {
    /**
     * Explicitly enables or disables ANSI styles instead of using automatic color detection.
     */
    colors?: boolean;
}
/**
 * Creates style helpers that either emit ANSI escape sequences or pass text through unchanged.
 *
 * @param options Style options
 * @returns Terminal style helpers
 */
export declare function createStyles(options?: CreateStylesOptions): TerminalStyles;
//# sourceMappingURL=styles.d.ts.map