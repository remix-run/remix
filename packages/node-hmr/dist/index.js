import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { createWatchedProcessController } from "./lib/runner.js";
/**
 * Wraps a fetch handler so requests wait for the current HMR generation to be ready.
 *
 * If the wrapped fetch handler returns a retryable response or throws a retryable error, the
 * request is attempted again only when the runner moved to a new generation while the request was
 * in flight.
 *
 * @param runner HMR runner that controls server readiness.
 * @param fetch Fetch handler to call once the runner is ready.
 * @param options Retry behavior for responses and thrown errors.
 * @returns A fetch handler that waits for HMR readiness before forwarding requests.
 */
export function createHmrReadyFetch(runner, fetch, options = {}) {
    let shouldRetry = options.shouldRetry ?? shouldRetrySafeUnavailableRequest;
    return async (request) => {
        while (true) {
            await runner.ready();
            let generation = runner.generation;
            try {
                let response = await fetch(request);
                if (!(await shouldRetry({ generation, request, response }))) {
                    return response;
                }
                await runner.ready();
                if (runner.generation !== generation)
                    continue;
                return response;
            }
            catch (error) {
                await runner.ready();
                if (runner.generation !== generation &&
                    (await shouldRetry({ error, generation, request }))) {
                    continue;
                }
                throw error;
            }
        }
    };
}
/**
 * Starts a Node.js entry module under HMR supervision.
 *
 * @param entry Entry module path to run.
 * @param options Runner options.
 * @returns A runner handle for the supervised process.
 */
export function run(entry, options = {}) {
    let controller = createWatchedProcessController({
        browserHmrChannel: normalizeBrowserHmrChannelOptions(options.browserHmrChannel),
        cwd: options.cwd ?? process.cwd(),
        entry,
        entryArgs: [...(options.entryArgs ?? [])],
        env: options.env ?? process.env,
        nodeArgs: [...(options.nodeArgs ?? [])],
        registerPath: resolveRegisterPath(),
        watch: options.watch,
    });
    let closed = controller.start();
    closed.catch((error) => {
        console.error(error);
    });
    return {
        close() {
            return controller.stop();
        },
        get generation() {
            return controller.generation;
        },
        ready() {
            return controller.ready();
        },
    };
}
function shouldRetrySafeUnavailableRequest({ request, response, }) {
    if (request.method !== 'GET' && request.method !== 'HEAD')
        return false;
    return (response === undefined ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504);
}
function normalizeBrowserHmrChannelOptions(options) {
    if (options === false)
        return null;
    if (options === undefined || options === true)
        return {};
    if (options.port !== undefined) {
        assertValidPort(options.port);
    }
    return options;
}
function resolveRegisterPath() {
    let extension = import.meta.url.endsWith('.ts') ? 'ts' : 'js';
    return fileURLToPath(new URL(`./register.${extension}`, import.meta.url));
}
function assertValidPort(port) {
    if (!Number.isInteger(port) || port < 0 || port > 65_535) {
        throw new TypeError(`Invalid browser HMR channel port: ${port}`);
    }
}
