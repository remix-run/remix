import { emitServerReady, getNodeHmrRuntime } from './lib/runtime.ts'
import type { BrowserHmrChannel } from './lib/browser-events.ts'

export type { BrowserHmrChannel } from './lib/browser-events.ts'

/**
 * Creates a browser HMR channel from the active Node HMR runtime.
 *
 * @returns A browser HMR channel when running under `node-hmr`, otherwise `undefined`.
 */
export async function createBrowserHmrChannel(): Promise<BrowserHmrChannel | undefined> {
  return await getNodeHmrRuntime()?.createBrowserHmrChannel()
}

export { emitServerReady }
