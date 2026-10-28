import { getTopFrame, getNamedFrame } from './run.ts';
import { reloadFrameForNavigation } from './frame.ts';
/**
 * Options for client-side frame-aware navigation.
 */
export type NavigationOptions = {
    /**
     * Same-origin source override for a mounted named frame, resolved against the document base URL.
     * Invalid or cross-origin values fall back to document navigation. Top-frame navigations use
     * `href` to keep the frame source in sync with the browser URL.
     */
    src?: string;
    /**
     * Mounted named frame to reload. When omitted, the top frame reloads. An unmatched name falls
     * back to document navigation.
     */
    target?: string;
    /** How the destination updates browser history. */
    history?: 'push' | 'replace';
    /**
     * Scroll behavior. `true` aliases `"after-transition"` and `false` aliases `"manual"`.
     * (default: `"after-transition"`)
     */
    resetScroll?: NavigationInterceptOptions['scroll'] | boolean;
    /**
     * Focus reset behavior. `true` aliases `"after-transition"` and `false` aliases `"manual"`.
     * (default: `"after-transition"`)
     */
    resetFocus?: NavigationInterceptOptions['focusReset'] | boolean;
};
/**
 * Performs a Navigation API transition understood by Remix frame runtime state.
 * Invalid or cross-origin sources fall back to document navigation.
 *
 * @param href Destination URL.
 * @param options Navigation options.
 * @returns A promise that settles when the Navigation API transition finishes.
 */
export declare function navigate(href: string, options?: NavigationOptions): Promise<void>;
/**
 * Options for updating the current URL.
 */
export interface UpdateUrlOptions {
    /** How the URL updates browser history. (default: `"replace"`) */
    history?: 'replace' | 'push';
    /** Cancels a pending URL update without aborting the navigation it is waiting for. */
    signal?: AbortSignal;
}
/**
 * Updates the current URL without fetching, rendering, or changing scroll and focus.
 * Replaces the current history entry by default; use `history: 'push'` to add an entry.
 * Waits for the current navigation, rejecting if it fails, is superseded, or changes destination.
 * Keeps Remix history state and the top-frame source in sync. Cross-origin URLs reject with
 * `SecurityError`; superseded or redirected updates reject with `AbortError`.
 * An aborted signal rejects with its reason without aborting the navigation.
 * Do not await this inside the active navigation's own interception handler.
 *
 * @param href Same-origin URL, resolved against the document base URL when the update executes.
 * @param options History and cancellation options.
 * @returns A promise that resolves after the URL update, or rejects on cancellation or failure.
 */
export declare function updateUrl(href: string, options?: UpdateUrlOptions): Promise<void>;
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
export declare function getInterceptableNavigation(): Navigation | undefined;
