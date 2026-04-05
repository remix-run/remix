const textEncoder = new TextEncoder();
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/**
 * Creates a `fetch` function that signs requests with DPoP proofs.
 *
 * @param options Token state and request-signing options.
 * @returns A fetch function that adds `Authorization: DPoP ...` and `DPoP` headers.
 */
export function createFetch(options) {
    let accessToken = normalizeAccessToken(options.accessToken);
    let hasRefreshToken = typeof options.refreshToken === 'string' && options.refreshToken.trim().length > 0;
    let expiresAt = options.expiresAt;
    let dpop = normalizeDpopBinding(options.dpop);
    let onDpopChange = options.onDpopChange;
    let localFetch = options.fetch ?? globalThis.fetch;
    let privateKeyPromise = importPrivateEcKey(dpop.privateJwk);
    return async (input, init) => {
        assertTokenIsCurrent(expiresAt, hasRefreshToken);
        let request = new Request(input, init);
        let body = await readRequestBody(request);
        for (let attempt = 0; attempt < 2; attempt++) {
            let response = await localFetch(request.url, await createSignedRequestInit({
                request,
                body,
                accessToken,
                dpop,
                privateKey: await privateKeyPromise,
            }));
            let nextNonce = response.headers.get('DPoP-Nonce') ?? undefined;
            if (response.ok) {
                if (nextNonce != null) {
                    await updateDpopBinding(dpop, nextNonce, onDpopChange);
                }
                return response;
            }
            if (attempt === 0 &&
                nextNonce != null &&
                (response.status === 400 || response.status === 401) &&
                (await isUseDpopNonceResponse(response))) {
                await updateDpopBinding(dpop, nextNonce, onDpopChange);
                continue;
            }
            if (nextNonce != null) {
                await updateDpopBinding(dpop, nextNonce, onDpopChange);
            }
            return response;
        }
        throw new Error('DPoP request retry failed.');
    };
}
async function updateDpopBinding(dpop, nextNonce, onDpopChange) {
    if (dpop.nonce === nextNonce) {
        return;
    }
    dpop.nonce = nextNonce;
    await onDpopChange?.({ ...dpop });
}
async function createSignedRequestInit(options) {
    let headers = new Headers(options.request.headers);
    headers.set('Authorization', `DPoP ${options.accessToken}`);
    headers.set('DPoP', await createDpopProof({
        method: options.request.method,
        url: options.request.url,
        nonce: options.dpop.nonce,
        privateKey: options.privateKey,
        publicJwk: options.dpop.publicJwk,
    }));
    let init = {
        method: options.request.method,
        headers,
        cache: options.request.cache,
        credentials: options.request.credentials,
        integrity: options.request.integrity,
        keepalive: options.request.keepalive,
        mode: options.request.mode,
        redirect: options.request.redirect,
        referrer: options.request.referrer,
        referrerPolicy: options.request.referrerPolicy,
        signal: options.request.signal,
    };
    if (options.body != null) {
        init.body = options.body.slice();
        init.duplex = 'half';
    }
    return init;
}
function normalizeAccessToken(accessToken) {
    if (typeof accessToken !== 'string' || accessToken.trim().length === 0) {
        throw new Error('createFetch() requires a non-empty accessToken.');
    }
    return accessToken;
}
function normalizeDpopBinding(dpop) {
    if (typeof dpop !== 'object' || dpop == null) {
        throw new Error('createFetch() requires DPoP binding data.');
    }
    if (typeof dpop.publicJwk !== 'object' || dpop.publicJwk == null) {
        throw new Error('createFetch() requires a DPoP publicJwk.');
    }
    if (typeof dpop.privateJwk !== 'object' || dpop.privateJwk == null) {
        throw new Error('createFetch() requires a DPoP privateJwk.');
    }
    return {
        publicJwk: dpop.publicJwk,
        privateJwk: dpop.privateJwk,
        nonce: dpop.nonce,
    };
}
function assertTokenIsCurrent(expiresAt, hasRefreshToken) {
    if (expiresAt == null) {
        return;
    }
    if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
        throw new Error('createFetch() received an invalid expiresAt value.');
    }
    if (expiresAt.getTime() > Date.now()) {
        return;
    }
    throw new Error(hasRefreshToken
        ? 'DPoP access token has expired. Refresh it and create a new fetch instance.'
        : 'DPoP access token has expired.');
}
async function readRequestBody(request) {
    if (request.method === 'GET' || request.method === 'HEAD') {
        return;
    }
    return new Uint8Array(await request.arrayBuffer());
}
async function isUseDpopNonceResponse(response) {
    let authenticate = response.headers.get('WWW-Authenticate');
    if (typeof authenticate === 'string' && authenticate.toLowerCase().includes('use_dpop_nonce')) {
        return true;
    }
    let contentType = response.headers.get('Content-Type');
    if (typeof contentType !== 'string' || !contentType.includes('application/json')) {
        return false;
    }
    try {
        let json = (await response.clone().json());
        return json.error === 'use_dpop_nonce';
    }
    catch {
        return false;
    }
}
async function importPrivateEcKey(jwk) {
    return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
        'sign',
    ]);
}
async function createDpopProof(options) {
    return createSignedJwt({
        alg: 'ES256',
        jwk: toPublicEcJwk(options.publicJwk),
        typ: 'dpop+jwt',
    }, {
        exp: getUnixTimestamp() + 60,
        htm: options.method.toUpperCase(),
        htu: options.url,
        iat: getUnixTimestamp(),
        jti: createJwtId(),
        nonce: options.nonce,
    }, options.privateKey);
}
async function createSignedJwt(header, payload, key) {
    let encodedHeader = base64UrlEncodeJson(header);
    let encodedPayload = base64UrlEncodeJson(Object.fromEntries(Object.entries(payload).filter(([, value]) => value != null)));
    let signingInput = `${encodedHeader}.${encodedPayload}`;
    let signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, textEncoder.encode(signingInput));
    return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
}
function toPublicEcJwk(jwk) {
    return {
        crv: jwk.crv,
        kty: jwk.kty,
        x: jwk.x,
        y: jwk.y,
    };
}
function getUnixTimestamp() {
    return Math.floor(Date.now() / 1000);
}
function createJwtId() {
    let bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return toBase64Url(bytes);
}
function base64UrlEncodeJson(value) {
    return toBase64Url(textEncoder.encode(JSON.stringify(value)));
}
function toBase64Url(bytes) {
    let text = '';
    for (let index = 0; index < bytes.length; index += 3) {
        let chunk = ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
        text += base64Chars[(chunk >> 18) & 0x3f];
        text += base64Chars[(chunk >> 12) & 0x3f];
        text += index + 1 < bytes.length ? base64Chars[(chunk >> 6) & 0x3f] : '=';
        text += index + 2 < bytes.length ? base64Chars[chunk & 0x3f] : '=';
    }
    return text.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
