import { type Handle, type RemixNode } from '@remix-run/ui';
/**
 * Props accepted by the {@link SPA} component.
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
 * Renders browser URLs through a URL-to-node router and intercepts same-origin navigations.
 *
 * Form submissions are dispatched as `POST` requests with their `FormData`. Submissions to the
 * active URL replace the current history entry, while submissions to a different URL push a new
 * entry. Navigation history entries do not retain submitted `FormData`, so history traversals
 * revisit form destinations with `GET` requests.
 *
 * @param handle Component handle containing the router and initial fallback.
 * @returns A render function for the active router output.
 */
export declare function SPA(handle: Handle<SPAProps, SPAContext>): () => RemixNode;
