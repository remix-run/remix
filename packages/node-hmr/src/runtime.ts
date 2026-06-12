import { getNodeHmrRuntime } from './lib/runtime.ts'

export type { HmrEventChannel, HmrEventPayload } from './lib/browser-events.ts'

export const eventChannel = getNodeHmrRuntime()?.eventChannel
