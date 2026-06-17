import { emitServerReady, getNodeHmrRuntime } from './lib/runtime.ts'

export type { BrowserEventController, HmrEventPayload } from './lib/browser-events.ts'

export const browserEventController = getNodeHmrRuntime()?.browserEventController
export { emitServerReady }
