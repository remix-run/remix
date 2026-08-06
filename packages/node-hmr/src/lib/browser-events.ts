import process from 'node:process'

import { hasNodeHmrParentProcess } from './process-state.ts'

export const defaultBrowserHmrPathname = '/hmr'

/**
 * Event payload sent to browser HMR clients.
 */
export interface HmrEventPayload {
  /** Event type string consumed by browser HMR clients. */
  type: string
  [key: string]: unknown
}

/** JavaScript or CSS module update sent to a browser HMR client. */
export type HmrBrowserUpdate =
  | {
      /** Importing module whose dependency-accept handler accepts this update. */
      acceptedPath?: string
      /** Public URL of the changed JavaScript module. */
      path: string
      /** Identifies a JavaScript module update. */
      type: 'js'
    }
  | {
      /** Public URL of the changed stylesheet. */
      path: string
      /** Identifies a stylesheet update. */
      type: 'css'
    }

/**
 * Browser HMR event emitted to connected clients.
 */
export type BrowserHmrEvent =
  | {
      /** Absolute source file paths that triggered this update. */
      files?: string[]
      /** Update timestamp used to bust module and stylesheet caches. */
      timestamp: number
      /** Browser update event. */
      type: 'update'
      /** JavaScript and CSS updates for the browser to apply. */
      updates: HmrBrowserUpdate[]
    }
  | {
      /** Absolute source file paths that could not be handled in place. */
      files?: string[]
      /** Browser reload event. */
      type: 'reload'
    }

/**
 * File watcher event reported to a browser HMR channel.
 */
export type BrowserHmrFileEvent = {
  /** Filesystem operation observed by the parent watcher. */
  event: 'add' | 'change' | 'unlink'
  /** Absolute path of the source file that changed. */
  filePath: string
}

/**
 * Handles file events and returns browser HMR events to emit.
 *
 * @param events File additions, changes, and removals reported together by the parent watcher.
 * @returns Browser events to publish in their returned order.
 */
export type BrowserHmrFileEventHandler = (
  events: readonly BrowserHmrFileEvent[],
) => Promise<readonly BrowserHmrEvent[]>

/**
 * Watched file delta for a browser HMR channel.
 */
export interface BrowserHmrWatchedFileDelta {
  /** Absolute source file paths newly required by this channel. */
  add: readonly string[]
  /** Absolute source file paths no longer required by this channel. */
  remove: readonly string[]
}

/**
 * Child-process bridge between browser asset tooling and the parent `node-hmr` runtime.
 *
 * The channel contributes files to the parent's shared watcher and converts matching file changes
 * into browser update or reload events. Close it when its owning asset server shuts down.
 */
export interface BrowserHmrChannel {
  /** Absolute URL of the parent-owned EventSource endpoint for browser HMR clients. */
  readonly url: string
  /** Closes this channel, unregisters its handlers, and removes its files from the parent watcher. */
  close(): void
  /**
   * Registers a handler that converts matching watcher events into events for browser clients.
   *
   * Multiple handlers may be registered; their returned browser events are concatenated. Calling
   * the returned cleanup function stops invoking this handler without closing the channel.
   *
   * @param handler Callback that maps a batch of file changes to browser HMR events.
   * @returns A cleanup function that unregisters only this handler.
   */
  onFileEvents(handler: BrowserHmrFileEventHandler): () => void
  /**
   * Adds and removes absolute file paths from the parent process's watcher for this channel.
   *
   * Paths remain watched until removed by a later delta or until the channel is closed. Repeated
   * additions and removals are idempotent.
   *
   * @param delta Files to add and remove from the watcher.
   */
  updateWatchedFiles(delta: BrowserHmrWatchedFileDelta): void
}

export function sendHmrEventPayload(payload: HmrEventPayload): void {
  if (!hasNodeHmrParentProcess()) return

  process.send?.({
    payload,
    type: 'node-hmr:child:browser-event-emitted',
  })
}
