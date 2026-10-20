import { getTopFrame, getNamedFrame } from './run.ts';
import { reloadFrameForNavigation } from './frame.ts';
import { TypedEventTarget } from './typed-event-target.ts';
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
     * reloads the top frame like any other entry. Without frame navigation, `history: 'replace'`
     * replaces the URL in place, and other updates fall back to document navigation like other
     * `navigate()` calls. If a frame navigation is still loading,
     * the top frame reloads instead, so await `navigation.settled()` first. (default: `true`)
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
 * The form submission that started a navigation.
 */
export interface NavigationSubmission {
    /** Upper-case form method, including submitter overrides, such as `"POST"`. */
    readonly method: string;
    /** Form encoding type, including submitter overrides. */
    readonly encType: string;
    /** Submitted entries for non-GET submissions. GET submissions encode their values in the URL. */
    readonly formData: FormData | undefined;
}
/**
 * A frame navigation the Remix runtime is handling.
 */
export interface PendingNavigation {
    /** Destination URL. Changes to the final URL when the top frame follows a redirect. */
    readonly url: string;
    /** How the navigation changes history. A redirect doesn't change it. */
    readonly type: 'push' | 'replace' | 'reload' | 'traverse';
    /** Named frame the navigation loads, or `undefined` for the top frame. */
    readonly target: string | undefined;
    /** Form submission that started the navigation, or `undefined` for links and `navigate()`. */
    readonly submission: NavigationSubmission | undefined;
    /** Aborted when another navigation replaces this one, or when it fails. */
    readonly signal: AbortSignal;
}
/**
 * Events dispatched by {@link navigation}.
 */
export type NavigationEventMap = {
    /** `navigation.current` started, changed, or ended. */
    change: Event;
};
/**
 * Client-side frame navigation state for the Remix runtime.
 */
export interface NavigationState extends TypedEventTarget<NavigationEventMap> {
    /**
     * Whether the Remix runtime handles links, forms, and `navigate()` as frame navigations in this
     * browser. Without the Navigation API and `NavigateEvent.sourceElement`, they load documents
     * instead. Always `false` on the server.
     */
    readonly supported: boolean;
    /**
     * The frame navigation Remix is handling, or `null`. It's set as soon as Remix intercepts a
     * navigation, so later `navigate` listeners see it, and stays the same object through frame
     * redirects. URL updates with `reload: false`, frame reloads, and document navigations aren't
     * frame navigations, so they don't appear here.
     */
    readonly current: PendingNavigation | null;
    /**
     * Waits until no navigation is in progress. By then, Remix has rendered the destination,
     * followed any frame redirect, and reset or restored scroll and focus. If another navigation
     * starts while waiting, this waits for that one too. It also waits for navigations other code
     * intercepts, since changing the URL would interrupt those as well.
     *
     * Components rendered by a navigation can run their queued tasks before the navigation
     * finishes. Changing the URL from one of those tasks interrupts the navigation before it resets
     * scroll and focus, so wait for this first.
     *
     * @returns A promise that resolves once no navigation is in progress. It resolves right away when
     * nothing is navigating, frame navigation is unsupported, or on the server, and it never rejects.
     */
    settled(): Promise<void>;
}
/**
 * Client-side frame navigation state for the Remix runtime: whether frame navigation is supported,
 * the navigation in progress, and a way to wait for it to finish.
 */
export declare const navigation: NavigationState;
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
