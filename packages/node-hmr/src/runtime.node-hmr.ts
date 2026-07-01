import { emitServerReady, getNodeHmrRuntime } from './lib/runtime.ts'
import type { NodeHmrRuntimeApi } from './lib/runtime-api.ts'
import { nodeHmrRuntimeUnavailableError } from './lib/runtime-api.ts'

export type { BrowserHmrChannel } from './lib/browser-events.ts'

const maybeNodeHmrRuntime = getNodeHmrRuntime()
if (maybeNodeHmrRuntime === undefined) {
  throw new Error(nodeHmrRuntimeUnavailableError)
}
const nodeHmrRuntime = maybeNodeHmrRuntime

/**
 * Creates a browser HMR channel from the active Node HMR runtime.
 *
 * @returns A browser HMR channel for the current child process.
 */
export const createBrowserHmrChannel: NodeHmrRuntimeApi['createBrowserHmrChannel'] =
  async function createBrowserHmrChannel() {
    return await nodeHmrRuntime.createBrowserHmrChannel()
  }

const emitRuntimeServerReady: NodeHmrRuntimeApi['emitServerReady'] = emitServerReady
export { emitRuntimeServerReady as emitServerReady }
