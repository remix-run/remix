export const oauthProviderRuntime = Symbol('oauth-provider-runtime');
const oauthProviderTokens = Symbol('oauth-provider-tokens');
export function createOAuthProvider(name, runtime) {
    return {
        name,
        [oauthProviderRuntime]: runtime,
    };
}
export function getOAuthProviderRuntime(provider) {
    let runtime = provider[oauthProviderRuntime];
    if (runtime == null) {
        throw new Error(`Invalid OAuth provider "${provider.name}".`);
    }
    return runtime;
}
export function createAuthorizationURL(endpoint, params) {
    let url = new URL(endpoint);
    for (let [key, value] of Object.entries(params)) {
        if (value != null) {
            url.searchParams.set(key, value);
        }
    }
    return url;
}
export async function exchangeAuthorizationCode(options) {
    return exchangeOAuthTokens({
        ...options,
        fallbackError: 'OAuth token exchange failed.',
    }, new URLSearchParams({
        code: options.code,
        code_verifier: options.codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: toURLString(options.redirectUri),
    }));
}
export async function exchangeRefreshToken(options) {
    let params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: options.refreshToken,
    });
    if (options.scopes != null && options.scopes.length > 0) {
        params.set('scope', options.scopes.join(' '));
    }
    return exchangeOAuthTokens({
        ...options,
        fallbackError: 'OAuth refresh token exchange failed.',
    }, params);
}
export function mergeRefreshedStandardTokens(currentTokens, refreshedTokens) {
    return {
        ...currentTokens,
        ...refreshedTokens,
        refreshToken: refreshedTokens.refreshToken ?? currentTokens.refreshToken,
        tokenType: refreshedTokens.tokenType ?? currentTokens.tokenType,
        expiresAt: refreshedTokens.expiresAt ?? currentTokens.expiresAt,
        scope: refreshedTokens.scope ?? currentTokens.scope,
        idToken: refreshedTokens.idToken ?? currentTokens.idToken,
    };
}
export async function fetchJson(input, init, fallbackError) {
    let response = await fetch(input, init);
    let json = await readJson(response);
    if (!response.ok || hasOAuthError(json)) {
        throw new Error(getOAuthErrorMessage(json, fallbackError));
    }
    return json;
}
export function getAuthorizationCode(context) {
    let code = context.url.searchParams.get('code');
    if (code == null || code.length === 0) {
        throw new Error('Missing authorization code in OAuth callback request.');
    }
    return code;
}
async function exchangeOAuthTokens(options, params) {
    let clientAuthentication = options.clientAuthentication ?? 'request-body';
    if (clientAuthentication === 'request-body') {
        params.set('client_id', options.clientId);
        params.set('client_secret', options.clientSecret);
    }
    let response = await fetch(options.tokenEndpoint, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(clientAuthentication === 'basic'
                ? {
                    Authorization: `Basic ${encodeBasicAuth(options.clientId, options.clientSecret)}`,
                }
                : undefined),
            ...options.headers,
        },
        body: params,
    });
    let json = await readJson(response);
    if (!response.ok || hasOAuthError(json)) {
        throw new Error(getOAuthErrorMessage(json, options.fallbackError));
    }
    return normalizeOAuthTokenResponse(json);
}
function normalizeOAuthTokenResponse(json) {
    if (typeof json !== 'object' || json == null || Array.isArray(json)) {
        throw new Error('Expected OAuth provider to return a JSON object.');
    }
    let data = json;
    if (typeof data.access_token !== 'string' || data.access_token.length === 0) {
        throw new Error('OAuth token response did not include an access token.');
    }
    return {
        accessToken: data.access_token,
        refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
        tokenType: typeof data.token_type === 'string' ? data.token_type : undefined,
        expiresAt: typeof data.expires_in === 'number'
            ? new Date(Date.now() + data.expires_in * 1000)
            : undefined,
        scope: parseScope(data.scope),
        idToken: typeof data.id_token === 'string' ? data.id_token : undefined,
    };
}
function getOAuthErrorMessage(json, fallback) {
    if (typeof json !== 'object' || json == null || Array.isArray(json)) {
        return fallback;
    }
    let data = json;
    if (typeof data.error_description === 'string' && data.error_description.length > 0) {
        return data.error_description;
    }
    if (typeof data.error === 'string' && data.error.length > 0) {
        return data.error;
    }
    if (typeof data.message === 'string' && data.message.length > 0) {
        return data.message;
    }
    return fallback;
}
function hasOAuthError(json) {
    if (typeof json !== 'object' || json == null || Array.isArray(json)) {
        return false;
    }
    let data = json;
    return typeof data.error === 'string' || typeof data.error_description === 'string';
}
function parseScope(value) {
    if (typeof value !== 'string' || value.length === 0) {
        return;
    }
    return value
        .split(/[,\s]+/)
        .map((scope) => scope.trim())
        .filter((scope) => scope.length > 0);
}
async function readJson(response) {
    let text = await response.text();
    if (text.length === 0) {
        return {};
    }
    return JSON.parse(text);
}
function toURLString(value) {
    return typeof value === 'string' ? value : value.toString();
}
function encodeBasicAuth(clientId, clientSecret) {
    return btoa(`${clientId}:${clientSecret}`);
}
