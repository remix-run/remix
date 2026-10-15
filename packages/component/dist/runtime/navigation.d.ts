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
    /**
     * Whether to reload frame content. Set to `false` to update the browser URL and history without
     * fetching or rendering anything, leaving scroll position and focus untouched. `src`, `target`,
     * `resetScroll`, and `resetFocus` are ignored. Back and forward traversal to the new entry
     * reloads the top frame like any other entry. Without frame navigation, this falls back to
     * document navigation like other `navigate()` calls. (default: `true`)
     */
    reload?: boolean;
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
