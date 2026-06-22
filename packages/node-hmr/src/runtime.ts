import { emitServerReady, getNodeHmrRuntime } from './lib/runtime.ts'
import type { BrowserHmrChannel } from './lib/browser-events.ts'

export type {
  BrowserHmrChannel,
  BrowserHmrEvent,
  BrowserHmrFileEvent,
  BrowserHmrFileEventHandler,
  BrowserHmrWatchedFileDelta,
  HmrEventPayload,
} from './lib/browser-events.ts'

export function createBrowserHmrChannel(): BrowserHmrChannel | undefined {
  return getNodeHmrRuntime()?.createBrowserHmrChannel()
}

export { emitServerReady }
