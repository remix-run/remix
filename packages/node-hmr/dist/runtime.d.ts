import type { NodeHmrRuntimeApi } from './lib/runtime-api.ts';
export type { BrowserHmrChannel } from './lib/browser-events.ts';
/**
 * Creates a browser HMR channel from the active Node HMR runtime.
 *
 * @returns A browser HMR channel for the current child process.
 */
export declare const createBrowserHmrChannel: NodeHmrRuntimeApi['createBrowserHmrChannel'];
/**
 * Notifies the parent process that the child server is ready.
 */
export declare const emitServerReady: NodeHmrRuntimeApi['emitServerReady'];
//# sourceMappingURL=runtime.d.ts.map