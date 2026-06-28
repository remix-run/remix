import { nodeHmrRuntimeUnavailableError } from "./lib/runtime-api.js";
/**
 * Creates a browser HMR channel from the active Node HMR runtime.
 *
 * @returns A browser HMR channel for the current child process.
 */
export const createBrowserHmrChannel = async function createBrowserHmrChannel() {
    throwNodeHmrRuntimeUnavailable();
};
/**
 * Notifies the parent process that the child server is ready.
 */
export const emitServerReady = function emitServerReady() {
    throwNodeHmrRuntimeUnavailable();
};
throwNodeHmrRuntimeUnavailable();
function throwNodeHmrRuntimeUnavailable() {
    throw new Error(nodeHmrRuntimeUnavailableError);
}
