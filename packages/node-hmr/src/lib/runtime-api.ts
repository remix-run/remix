import type { BrowserHmrChannel } from './browser-events.ts'

export interface NodeHmrRuntimeApi {
  createBrowserHmrChannel(): Promise<BrowserHmrChannel>
  emitServerReady(): void
}

export const nodeHmrRuntimeUnavailableError =
  'The node-hmr/runtime API is only available when running inside node-hmr'
