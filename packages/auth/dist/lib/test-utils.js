import * as http from 'node:http';
import { SetCookie } from '@remix-run/headers';
import { createCodeChallenge } from "./utils.js";
export function createRequest(url, fromResponse, init = {}) {
    let headers = new Headers(init.headers);
    if (fromResponse != null) {
        let cookieValues = fromResponse.headers
            .getSetCookie()
            .map((value) => new SetCookie(value))
            .map((cookie) => `${cookie.name}=${cookie.value}`);
        if (cookieValues.length > 0) {
            headers.set('Cookie', cookieValues.join('; '));
        }
    }
    return new Request(url, {
        ...init,
        headers,
    });
}
export function mockFetch(handler) {
    let originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => handler(input, init));
    return () => {
        globalThis.fetch = originalFetch;
    };
}
export async function startFakeOAuthServer(profile = {
    sub: 'fake-user',
    email: 'fake@example.com',
    name: 'Fake User',
}) {
    return await new Promise((resolve, reject) => {
        let expectedChallenge;
        let expectedState;
        let accessToken = 'fake-access-token';
        let server = http.createServer(async (req, res) => {
            if (req.url == null) {
                res.statusCode = 400;
                res.end('Missing URL');
                return;
            }
            let url = new URL(req.url, 'http://127.0.0.1');
            if (req.method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                    issuer: originFromAddress(server.address()),
                    authorization_endpoint: `${originFromAddress(server.address())}/authorize`,
                    token_endpoint: `${originFromAddress(server.address())}/token`,
                    userinfo_endpoint: `${originFromAddress(server.address())}/userinfo`,
                    code_challenge_methods_supported: ['S256'],
                    scopes_supported: ['openid', 'email', 'profile'],
                }));
                return;
            }
            if (req.method === 'GET' && url.pathname === '/authorize') {
                expectedState = url.searchParams.get('state') ?? undefined;
                expectedChallenge = url.searchParams.get('code_challenge') ?? undefined;
                let redirectUri = url.searchParams.get('redirect_uri');
                if (redirectUri == null || expectedState == null || expectedChallenge == null) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        error: 'invalid_request',
                        error_description: 'Missing redirect_uri, state, or code_challenge',
                    }));
                    return;
                }
                let redirectURL = new URL(redirectUri);
                redirectURL.searchParams.set('code', 'fake-authorization-code');
                redirectURL.searchParams.set('state', expectedState);
                res.statusCode = 302;
                res.setHeader('Location', redirectURL.toString());
                res.end();
                return;
            }
            if (req.method === 'POST' && url.pathname === '/token') {
                let body = await readRequestBody(req);
                let params = new URLSearchParams(body);
                let codeVerifier = params.get('code_verifier');
                if (params.get('code') !== 'fake-authorization-code' ||
                    codeVerifier == null ||
                    expectedChallenge == null ||
                    (await createCodeChallenge(codeVerifier)) !== expectedChallenge) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        error: 'invalid_grant',
                        error_description: 'Code verifier validation failed',
                    }));
                    return;
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                    access_token: accessToken,
                    token_type: 'Bearer',
                    scope: 'openid email profile',
                }));
                return;
            }
            if (req.method === 'GET' && url.pathname === '/userinfo') {
                if (req.headers.authorization !== `Bearer ${accessToken}`) {
                    res.statusCode = 401;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        error: 'invalid_token',
                    }));
                    return;
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(profile));
                return;
            }
            res.statusCode = 404;
            res.end('Not found');
        });
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            let address = server.address();
            if (address == null || typeof address === 'string') {
                reject(new Error('Failed to resolve fake OAuth server address'));
                return;
            }
            resolve({
                origin: originFromAddress(address),
                close: () => new Promise((resolveClose, rejectClose) => {
                    server.close((error) => {
                        if (error) {
                            rejectClose(error);
                            return;
                        }
                        resolveClose();
                    });
                }),
            });
        });
    });
}
async function readRequestBody(request) {
    let chunks = [];
    for await (let chunk of request) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}
function originFromAddress(address) {
    if (address == null || typeof address === 'string') {
        throw new Error('Failed to resolve fake OAuth server address');
    }
    return `http://127.0.0.1:${address.port}`;
}
