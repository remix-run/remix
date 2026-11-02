import { type TerminalEnvironment } from './env.ts';
import { type CreateStylesOptions, type TerminalStyles } from './styles.ts';
/**
 * Input stream shape used for terminal interactivity detection.
 */
export interface TerminalInputStream {
    /**
     * Whether the input stream is attached to a TTY.
     */
    readonly isTTY?: boolean;
}
/**
 * Output stream shape used for terminal writes and TTY detection.
 */
export interface TerminalOutputStream {
    /**
     * Whether the output stream is attached to a TTY.
     */
    readonly isTTY?: boolean;
    /**
     * Writes a chunk of text to the output stream.
     *
     * @param chunk Text chunk to write.
     * @returns Stream-specific write result.
     */
    write(chunk: string): unknown;
}
/**
 * Options used to create a terminal abstraction.
 */
export interface TerminalOptions extends CreateStylesOptions {
    /**
     * Input stream used to detect whether the terminal is interactive (defaults to `process.stdin`).
     */
    stdin?: TerminalInputStream;
    /**
     * Output stream used for normal output (defaults to `process.stdout`).
     */
    stdout?: TerminalOutputStream;
    /**
     * Output stream used for error output (defaults to `process.stderr`).
     */
    stderr?: TerminalOutputStream;
}
/**
 * Testable abstraction around terminal input, output, styles, and controls.
 */
export interface Terminal {
    /**
     * Environment variables used by this terminal.
     */
    readonly env: TerminalEnvironment;
    /**
     * Output stream used for error output.
     */
    readonly stderr: TerminalOutputStream;
    /**
     * Input stream used for interactivity detection.
     */
    readonly stdin: TerminalInputStream;
    /**
     * Output stream used for normal output.
     */
    readonly stdout: TerminalOutputStream;
    /**
     * Style helpers configured for this terminal's output stream.
     */
    readonly styles: TerminalStyles;
    /**
     * Whether both input and output streams are attached to TTYs.
     */
    readonly isInteractive: boolean;
    /**
     * Whether the output stream is attached to a TTY.
     */
    readonly isTTY: boolean;
    /**
     * Clears the current output line.
     */
    clearLine(): void;
    /**
     * Moves the output cursor to a zero-based column and optional row.
     *
     * @param column Zero-based output column.
     * @param row Optional zero-based output row.
     */
    cursorTo(column: number, row?: number): void;
    /**
     * Erases output from the cursor through the end of the terminal.
     */
    eraseDown(): void;
    /**
     * Writes a value to the error output stream.
     *
     * @param value Text to write.
     */
    error(value: string): void;
    /**
     * Writes a value and trailing newline to the error output stream.
     *
     * @param value Text to write (defaults to an empty string).
     */
    errorLine(value?: string): void;
    /**
     * Hides the terminal cursor.
     */
    hideCursor(): void;
    /**
     * Moves the output cursor by relative column and row offsets.
     *
     * @param columns Relative column offset.
     * @param rows Relative row offset.
     */
    moveCursor(columns: number, rows: number): void;
    /**
     * Shows the terminal cursor.
     */
    showCursor(): void;
    /**
     * Writes a value to the normal output stream.
     *
     * @param value Text to write.
     */
    write(value: string): void;
    /**
     * Writes a value and trailing newline to the normal output stream.
     *
     * @param value Text to write (defaults to an empty string).
     */
    writeLine(value?: string): void;
}
/**
 * Creates a small terminal abstraction around stdout/stderr/stdin.
 *
 * @param options Terminal stream and style options
 * @returns A terminal abstraction
 */
export declare function createTerminal(options?: TerminalOptions): Terminal;
//# sourceMappingURL=terminal.d.ts.map