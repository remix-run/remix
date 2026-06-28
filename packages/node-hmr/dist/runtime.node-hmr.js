import { emitServerReady, getNodeHmrRuntime } from "./lib/runtime.js";
import { nodeHmrRuntimeUnavailableError } from "./lib/runtime-api.js";
const maybeNodeHmrRuntime = getNodeHmrRuntime();
if (maybeNodeHmrRuntime === undefined) {
    throw new Error(nodeHmrRuntimeUnavailableError);
}
const nodeHmrRuntime = maybeNodeHmrRuntime;
/**
 * Creates a browser HMR channel from the active Node HMR runtime.
 *
 * @returns A browser HMR channel for the current child process.
 */
export const createBrowserHmrChannel = async function createBrowserHmrChannel() {
    return await nodeHmrRuntime.createBrowserHmrChannel();
};
const emitRuntimeServerReady = emitServerReady;
export { emitRuntimeServerReady as emitServerReady };
