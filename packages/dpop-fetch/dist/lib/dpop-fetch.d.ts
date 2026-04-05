/**
 * DPoP binding state used to sign follow-up requests.
 */
export interface DpopBinding {
    /** Public JWK advertised in DPoP proofs. */
    publicJwk: JsonWebKey;
    /** Private JWK used to sign DPoP proofs. */
    privateJwk: JsonWebKey;
    /** Latest nonce returned by the target server, when one is required. */
    nonce?: string;
}
/**
 * Options for {@link createFetch}.
 */
export interface DpopFetchOptions {
    /** Access token sent in the `Authorization` header. */
    accessToken: string;
    /** Refresh token preserved by the caller for provider-specific refresh flows. */
    refreshToken?: string;
    /** Expiration time for the current access token, when known. */
    expiresAt?: Date;
    /** DPoP binding state returned by the authorization flow. */
    dpop: DpopBinding;
    /** Called when the DPoP binding changes so callers can persist the latest nonce. */
    onDpopChange?: (dpop: DpopBinding) => void | Promise<void>;
    /** Fetch implementation used to send requests. */
    fetch?: typeof globalThis.fetch;
}
/**
 * A `fetch` function created by {@link createFetch}.
 */
export interface DpopFetch {
    /**
     * Sends a DPoP-signed request with the configured access token.
     */
    (input: URL | RequestInfo, init?: RequestInit): Promise<Response>;
}
/**
 * Creates a `fetch` function that signs requests with DPoP proofs.
 *
 * @param options Token state and request-signing options.
 * @returns A fetch function that adds `Authorization: DPoP ...` and `DPoP` headers.
 */
export declare function createFetch(options: DpopFetchOptions): DpopFetch;
//# sourceMappingURL=dpop-fetch.d.ts.map