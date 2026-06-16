import { emitServerReady, getNodeHmrRuntime } from './lib/runtime.ts'

export type { BrowserEventChannel, HmrEventPayload } from './lib/browser-events.ts'

export const browserEventChannel = getNodeHmrRuntime()?.browserEventChannel
export { emitServerReady }
