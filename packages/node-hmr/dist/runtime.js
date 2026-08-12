import { nodeHmrRuntimeUnavailableError } from './lib/runtime-api.js';
/**
 * Connects browser asset tooling in this child process to the browser HMR event stream and file
 * watcher owned by its `node-hmr` parent process.
 *
 * Pass this function as the `hmr` factory for `createAssetServer()`. Each call creates an
 * independent channel that must be closed when its owner shuts down. The returned promise rejects
 * when browser HMR is disabled for the runner.
 *
 * The `remix/node-hmr/runtime` module itself can only be imported by a process supervised by
 * `node-hmr`. Use a dynamic import guarded by `process.env.REMIX_NODE_HMR` when the same entry module
 * also runs without HMR supervision.
 *
 * @returns A child-scoped channel for watching browser source files and publishing HMR events.
 */
export const createBrowserHmrChannel = async function createBrowserHmrChannel() {
    throwNodeHmrRuntimeUnavailable();
};
/**
 * Notifies the `node-hmr` parent that this child process is ready to serve requests.
 *
 * Call this after the app server starts listening. After a restart, `node-hmr` waits for this
 * signal before publishing the browser `server:update` event, preventing clients from refreshing
 * against a server that is not ready yet.
 */
export const emitServerReady = function emitServerReady() {
    throwNodeHmrRuntimeUnavailable();
};
throwNodeHmrRuntimeUnavailable();
function throwNodeHmrRuntimeUnavailable() {
    throw new Error(nodeHmrRuntimeUnavailableError);
}
