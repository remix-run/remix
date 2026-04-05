import { createAuthorizationURL, createOAuthProvider, exchangeAuthorizationCode, exchangeRefreshToken, fetchJson, getAuthorizationCode, mergeRefreshedStandardTokens, } from "../provider.js";
import { createCodeChallenge } from "../utils.js";
const DEFAULT_OIDC_SCOPES = ['openid', 'profile', 'email'];
/**
 * Creates an OpenID Connect provider backed by discovery metadata or explicit endpoints.
 *
 * @param options OIDC settings, client credentials, and optional profile mapping hooks.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export function createOIDCAuthProvider(options) {
    let name = options.name ?? 'oidc';
    let scopes = options.scopes ?? DEFAULT_OIDC_SCOPES;
    let metadataPromise;
    function getMetadata() {
        if (options.metadata != null) {
            return Promise.resolve(validateOIDCMetadata(options.metadata, name));
        }
        if (metadataPromise == null) {
            metadataPromise = discoverOIDCMetadata(options, name).catch((error) => {
                metadataPromise = undefined;
                throw error;
            });
        }
        return metadataPromise;
    }
    return createOAuthProvider(name, {
        async createAuthorizationURL(transaction) {
            let metadata = await getMetadata();
            let challenge = await createCodeChallenge(transaction.codeVerifier);
            return createAuthorizationURL(metadata.authorization_endpoint, {
                ...options.authorizationParams,
                client_id: options.clientId,
                redirect_uri: toURLString(options.redirectUri),
                response_type: 'code',
                scope: scopes.join(' '),
                state: transaction.state,
                code_challenge: challenge,
                code_challenge_method: 'S256',
            });
        },
        async handleCallback(context, transaction) {
            let metadata = await getMetadata();
            let tokens = await exchangeAuthorizationCode({
                tokenEndpoint: metadata.token_endpoint,
                clientId: options.clientId,
                clientSecret: options.clientSecret,
                redirectUri: options.redirectUri,
                code: getAuthorizationCode(context),
                codeVerifier: transaction.codeVerifier,
            });
            let claims = await fetchOIDCProfile(name, metadata, tokens);
            let profile = await mapOIDCProfile(options, claims, tokens, metadata, context);
            return {
                provider: name,
                account: {
                    provider: name,
                    providerAccountId: claims.sub,
                },
                profile,
                tokens,
            };
        },
        async refreshTokens(currentTokens) {
            if (currentTokens.refreshToken == null || currentTokens.refreshToken.length === 0) {
                throw new Error(`OIDC provider "${name}" did not receive a refresh token.`);
            }
            let metadata = await getMetadata();
            let refreshedTokens = await exchangeRefreshToken({
                tokenEndpoint: metadata.token_endpoint,
                clientId: options.clientId,
                clientSecret: options.clientSecret,
                refreshToken: currentTokens.refreshToken,
            });
            return mergeRefreshedStandardTokens(currentTokens, refreshedTokens);
        },
    });
}
async function discoverOIDCMetadata(options, name) {
    let metadata = await fetchJson(options.discoveryUrl ?? createDiscoveryURL(options.issuer), {}, `Failed to load OIDC metadata for "${name}".`);
    return validateOIDCMetadata(metadata, name);
}
async function fetchOIDCProfile(name, metadata, tokens) {
    if (metadata.userinfo_endpoint == null || metadata.userinfo_endpoint.length === 0) {
        throw new Error(`OIDC provider "${name}" did not publish a userinfo_endpoint.`);
    }
    let claims = await fetchJson(metadata.userinfo_endpoint, {
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`,
        },
    }, `Failed to load OIDC profile for "${name}".`);
    if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
        throw new Error(`OIDC provider "${name}" did not return a valid "sub" claim.`);
    }
    return claims;
}
async function mapOIDCProfile(options, claims, tokens, metadata, context) {
    if (options.mapProfile == null) {
        return claims;
    }
    return options.mapProfile({
        claims,
        tokens,
        metadata,
        context,
    });
}
function createDiscoveryURL(issuer) {
    let base = toURLString(issuer);
    if (base.endsWith('/')) {
        return new URL(`${base}.well-known/openid-configuration`);
    }
    return new URL(`${base}/.well-known/openid-configuration`);
}
function toURLString(value) {
    return typeof value === 'string' ? value : value.toString();
}
function validateOIDCMetadata(metadata, name) {
    if (typeof metadata.issuer !== 'string' || metadata.issuer.length === 0) {
        throw new Error(`OIDC metadata for "${name}" did not include an issuer.`);
    }
    if (typeof metadata.authorization_endpoint !== 'string' ||
        metadata.authorization_endpoint.length === 0) {
        throw new Error(`OIDC metadata for "${name}" did not include an authorization_endpoint.`);
    }
    if (typeof metadata.token_endpoint !== 'string' || metadata.token_endpoint.length === 0) {
        throw new Error(`OIDC metadata for "${name}" did not include a token_endpoint.`);
    }
    return metadata;
}
