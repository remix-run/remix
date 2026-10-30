import type { AnyParams, ContextEntries, RequestContext } from '@remix-run/fetch-router';
/** The current document's CSP nonce, available after CSP middleware runs. */
export declare const CspNonce: {
    defaultValue?: string;
};
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
export declare function getCspNonce(context: RequestContext<AnyParams, ContextEntries>): string | undefined;
/**
 * Carries a document nonce into an internal render request before router dispatch.
 * Pass the same Request object to the router; cloning it does not carry the nonce.
 * @param request Internal request whose HTML will be embedded in the enclosing document.
 * @param nonce Enclosing document's nonce.
 */
export declare function inheritCspNonce(request: Request, nonce: string): void;
//# sourceMappingURL=nonce.d.ts.map