import { getTopFrame, getNamedFrame } from './run.ts';
/**
 * Options for client-side frame-aware navigation.
 */
export type NavigationOptions = {
    src?: string;
    target?: string;
    history?: 'push' | 'replace';
    resetScroll?: boolean;
};
/**
 * Performs a Navigation API transition understood by Remix frame runtime state.
 *
 * @param href Destination URL.
 * @param options Navigation options.
 */
export declare function navigate(href: string, options?: NavigationOptions): Promise<void>;
/**
 * Starts listening for Navigation API transitions and routes them through frame reloads.
 *
 * @param signal Abort signal used to remove the listener.
 * @returns void
 */
export declare function startNavigationListener(signal: AbortSignal): void;
export declare function startNavigationListenerImpl(signal: AbortSignal, options: {
    getTopFrame: typeof getTopFrame;
    getNamedFrame: typeof getNamedFrame;
}): void;
