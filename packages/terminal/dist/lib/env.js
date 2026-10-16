/**
 * Returns `true` when ANSI colors should be emitted for the given stream/environment.
 *
 * @param options Color detection options
 * @returns `true` when ANSI colors should be emitted
 */
export function shouldUseColors(options = {}) {
    let env = options.env ?? getDefaultEnvironment();
    if (env.NO_COLOR !== undefined) {
        return false;
    }
    let forceColor = env.FORCE_COLOR;
    if (forceColor !== undefined) {
        let value = forceColor.toLowerCase();
        return value !== '0' && value !== 'false';
    }
    if (env.CI === 'true') {
        return false;
    }
    if (env.TERM === 'dumb') {
        return false;
    }
    let stream = options.stream ?? getDefaultColorStream();
    return stream.isTTY === true;
}
/**
 * Returns the current process environment when it is available.
 *
 * @returns Current process environment variables, or an empty object outside Node-compatible runtimes.
 */
export function getDefaultEnvironment() {
    return typeof process === 'undefined' ? {} : process.env;
}
function getDefaultColorStream() {
    return typeof process === 'undefined' ? {} : process.stdout;
}
