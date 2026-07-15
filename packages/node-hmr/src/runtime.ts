import type { NodeHmrRuntimeApi } from './lib/runtime-api.ts'
import { nodeHmrRuntimeUnavailableError } from './lib/runtime-api.ts'

export type { BrowserHmrChannel } from './lib/browser-events.ts'

/**
 * Creates a browser HMR channel from the active Node HMR runtime.
 *
 * @returns A browser HMR channel for the current child process.
 */
export const createBrowserHmrChannel: NodeHmrRuntimeApi['createBrowserHmrChannel'] =
  async function createBrowserHmrChannel() {
    throwNodeHmrRuntimeUnavailable()
  }

/**
 * Notifies the parent process that the child server is ready.
 */
export const emitServerReady: NodeHmrRuntimeApi['emitServerReady'] = function emitServerReady() {
  throwNodeHmrRuntimeUnavailable()
}

throwNodeHmrRuntimeUnavailable()

function throwNodeHmrRuntimeUnavailable(): never {
  throw new Error(nodeHmrRuntimeUnavailableError)
}
