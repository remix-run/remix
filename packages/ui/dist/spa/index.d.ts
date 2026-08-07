import { type Handle, type RemixNode } from '@remix-run/ui';
/**
 * Options accepted by the {@link SPA} component and {@link createSPA} utility.
 */
export interface SPAProps {
    /** Content rendered until the initial URL resolves. */
    fallback: RemixNode;
    /** Router that resolves browser URLs to renderable UI. */
    router: {
        /**
         * Resolves a URL to renderable UI.
         *
         * @param url Destination URL.
         * @param init Request options, including the navigation signal and submitted form data.
         * @returns The UI for the destination.
         */
        fetch(url: URL, init: RequestInit): Promise<RemixNode>;
    };
}
/**
 * Navigation state provided to descendants of the {@link SPA} component.
 */
export interface SPAContext {
    /** URL represented by the currently rendered UI. */
    readonly active: URL;
    /** URL currently being loaded, or `undefined` when navigation is idle. */
    readonly pending: URL | undefined;
}
/**
 * Live SPA state used by custom SPA component implementations.
 */
export interface SPAMeta {
    /** Stable navigation state suitable for a component context. */
    readonly context: SPAContext;
    /** Currently rendered router output, or the fallback during the initial load. */
    readonly node: RemixNode;
}
/**
 * Renders browser URLs through a URL-to-node router and intercepts same-origin navigations.
 *
 * Form submissions use their native method. Non-GET submissions include their `FormData` and
 * replace the current history entry when submitted to the active URL. Submissions to a different
 * URL push a new entry. Navigation history entries do not retain submitted `FormData`, so history
 * traversals revisit form destinations with `GET` requests. Links and forms can use
 * `rmx-document` to bypass SPA interception or `rmx-history` to control history behavior.
 *
 * @param handle Component handle containing the router and initial fallback.
 * @returns A render function for the active router output.
 */
export declare function SPA(handle: Handle<SPAProps, SPAContext>): () => RemixNode;
/**
 * Creates SPA navigation state for use in a component setup scope.
 *
 * @param handle Component handle that owns the SPA navigation lifecycle.
 * @param options Router and fallback UI used to resolve browser URLs.
 * @returns Live SPA navigation state and rendered UI.
 */
export declare function createSPA(handle: Handle<unknown, unknown>, options: SPAProps): SPAMeta;
