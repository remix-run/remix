import { getTopFrame, getNamedFrame } from './run.ts';
import { reloadFrameForNavigation } from './frame.ts';
/**
 * Options for client-side frame-aware navigation.
 */
export type NavigationOptions = {
    /**
     * Same-origin source override for a mounted named frame, resolved against the document base URL.
     * Invalid or cross-origin values disable interception even when `target` is omitted or missing.
     * Top-frame navigations use `href` to keep the frame source in sync with the browser URL.
     */
    src?: string;
    target?: string;
    history?: 'push' | 'replace';
    resetScroll?: boolean;
};
/**
 * Performs a Navigation API transition understood by Remix frame runtime state.
 * Invalid or cross-origin sources fall back to document navigation.
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
    reloadFrame: typeof reloadFrameForNavigation;
}): void;
