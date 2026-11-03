import { type Handle, type RemixNode } from '@remix-run/component';
/** Options for rendering children outside their authored DOM ancestors. */
export type PortalProps = {
    /** Content that retains the portal's component context and frame. */
    children?: RemixNode;
    /** Destination in the same document. Defaults to its body. Changes preserve child state. */
    container?: HTMLElement | null;
};
/**
 * Renders children into a separate DOM container while preserving component context and state.
 * Server rendering emits an inert marker; children mount on the client. DOM events bubble through
 * the destination container. Child render errors are forwarded to the owning root.
 *
 * @param handle Component handle for the portal.
 * @returns A render function for the portal's inert marker.
 */
export declare function Portal(handle: Handle<PortalProps>): () => RemixNode;
