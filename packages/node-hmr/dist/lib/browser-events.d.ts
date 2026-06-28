export declare const defaultBrowserHmrPathname = "/hmr";
/**
 * Event payload sent to browser HMR clients.
 */
export interface HmrEventPayload {
    /** Event type string consumed by browser HMR clients. */
    type: string;
    [key: string]: unknown;
}
export type HmrBrowserUpdate = {
    acceptedPath?: string;
    path: string;
    type: 'js';
} | {
    path: string;
    type: 'css';
};
/**
 * Browser HMR event emitted to connected clients.
 */
export type BrowserHmrEvent = {
    /** Source files that triggered this update. */
    files?: string[];
    /** Update timestamp used to bust module and stylesheet caches. */
    timestamp: number;
    /** Browser update event. */
    type: 'update';
    /** JavaScript and CSS updates for the browser to apply. */
    updates: HmrBrowserUpdate[];
} | {
    /** Source files that triggered this reload. */
    files?: string[];
    /** Browser reload event. */
    type: 'reload';
};
/**
 * File watcher event reported to a browser HMR channel.
 */
export type BrowserHmrFileEvent = {
    /** File watcher event type. */
    event: 'add' | 'change' | 'unlink';
    /** Absolute file path that changed. */
    filePath: string;
};
/**
 * Handles file events and returns browser HMR events to emit.
 */
export type BrowserHmrFileEventHandler = (events: readonly BrowserHmrFileEvent[]) => Promise<readonly BrowserHmrEvent[]>;
/**
 * Watched file delta for a browser HMR channel.
 */
export interface BrowserHmrWatchedFileDelta {
    /** Absolute file paths to start watching. */
    add: readonly string[];
    /** Absolute file paths to stop watching. */
    remove: readonly string[];
}
/**
 * Channel used by asset tooling to coordinate browser HMR through `node-hmr`.
 */
export interface BrowserHmrChannel {
    /** EventSource URL for browser HMR clients. */
    readonly url: string;
    /** Closes the channel and removes all watched files. */
    close(): void;
    /**
     * Registers a file event handler.
     *
     * @param handler Callback that maps file events to browser HMR events.
     * @returns A cleanup function that unregisters the handler.
     */
    onFileEvents(handler: BrowserHmrFileEventHandler): () => void;
    /**
     * Updates the files watched on behalf of this channel.
     *
     * @param delta Files to add and remove from the watcher.
     */
    updateWatchedFiles(delta: BrowserHmrWatchedFileDelta): void;
}
export declare function sendHmrEventPayload(payload: HmrEventPayload): void;
//# sourceMappingURL=browser-events.d.ts.map