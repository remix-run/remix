import { createContextKey } from '@remix-run/fetch-router';
/** The current document's CSP nonce, available after CSP middleware runs. */
export const CspNonce = createContextKey();
const inheritedNonces = new WeakMap();
/**
 * Gets the CSP nonce for authored script and style tags or custom rendering.
 * Internal frame requests use the enclosing document's nonce. Reading it does not generate one.
 * @param context Current request context.
 * @returns The nonce, or undefined when no nonce has been established.
 * @example
 * ```tsx
 * <script src="/app.js" nonce={getCspNonce(context)} />
 * ```
 */
export function getCspNonce(context) {
    return inheritedNonces.get(context.request) ?? context.get(CspNonce);
}
/**
 * Carries a document nonce into an internal render request before router dispatch.
 * Pass the same Request object to the router; cloning it does not carry the nonce.
 * @param request Internal request whose HTML will be embedded in the enclosing document.
 * @param nonce Enclosing document's nonce.
 */
export function inheritCspNonce(request, nonce) {
    inheritedNonces.set(request, nonce);
}
