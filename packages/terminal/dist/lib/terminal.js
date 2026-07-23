import { ansi } from "./ansi.js";
import { getDefaultEnvironment } from "./env.js";
import { createStyles } from "./styles.js";
const noopOutputStream = {
    write() { },
};
const noopInputStream = {};
/**
 * Creates a small terminal abstraction around stdout/stderr/stdin.
 *
 * @param options Terminal stream and style options
 * @returns A terminal abstraction
 */
export function createTerminal(options = {}) {
    let stdin = options.stdin ?? getDefaultStdin();
    let stdout = options.stdout ?? getDefaultStdout();
    let stderr = options.stderr ?? getDefaultStderr();
    let env = options.env ?? getDefaultEnvironment();
    let colorDetectionStream = options.stream ?? stdout;
    let styles = options.colors === undefined
        ? createStyles({ env, stream: colorDetectionStream })
        : createStyles({ colors: options.colors, env, stream: colorDetectionStream });
    return {
        env,
        stderr,
        stdin,
        stdout,
        styles,
        get isInteractive() {
            return stdin.isTTY === true && stdout.isTTY === true;
        },
        get isTTY() {
            return stdout.isTTY === true;
        },
        clearLine() {
            stdout.write(ansi.clearLine);
        },
        cursorTo(column, row) {
            stdout.write(ansi.cursorTo(column, row));
        },
        eraseDown() {
            stdout.write(ansi.eraseDown);
        },
        error(value) {
            stderr.write(value);
        },
        errorLine(value = '') {
            stderr.write(value + '\n');
        },
        hideCursor() {
            stdout.write(ansi.hideCursor);
        },
        moveCursor(columns, rows) {
            stdout.write(ansi.moveCursor(columns, rows));
        },
        showCursor() {
            stdout.write(ansi.showCursor);
        },
        write(value) {
            stdout.write(value);
        },
        writeLine(value = '') {
            stdout.write(value + '\n');
        },
    };
}
function getDefaultStdin() {
    return typeof process === 'undefined' ? noopInputStream : process.stdin;
}
function getDefaultStdout() {
    return typeof process === 'undefined' ? noopOutputStream : process.stdout;
}
function getDefaultStderr() {
    return typeof process === 'undefined' ? noopOutputStream : process.stderr;
}
