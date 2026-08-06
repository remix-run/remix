import { createAuthorizationURL, createOAuthProvider, exchangeAuthorizationCode, fetchJson, getAuthorizationCode, } from "../provider.js";
import { createCodeChallenge } from "../utils.js";
const FACEBOOK_AUTHORIZATION_ENDPOINT = 'https://www.facebook.com/dialog/oauth';
const FACEBOOK_TOKEN_ENDPOINT = 'https://graph.facebook.com/oauth/access_token';
const FACEBOOK_PROFILE_ENDPOINT = 'https://graph.facebook.com/me?fields=id,name,email,picture';
const DEFAULT_FACEBOOK_SCOPES = ['public_profile', 'email'];
/**
 * Creates a Facebook Login provider.
 *
 * @param options Facebook OAuth client settings for your application.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export function createFacebookAuthProvider(options) {
    let scopes = options.scopes ?? DEFAULT_FACEBOOK_SCOPES;
    return createOAuthProvider('facebook', {
        async createAuthorizationURL(transaction) {
            let challenge = await createCodeChallenge(transaction.codeVerifier);
            return createAuthorizationURL(FACEBOOK_AUTHORIZATION_ENDPOINT, {
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
            let tokens = await exchangeAuthorizationCode({
                tokenEndpoint: FACEBOOK_TOKEN_ENDPOINT,
                clientId: options.clientId,
                clientSecret: options.clientSecret,
                redirectUri: options.redirectUri,
                code: getAuthorizationCode(context),
                codeVerifier: transaction.codeVerifier,
            });
            let profile = await fetchJson(FACEBOOK_PROFILE_ENDPOINT, {
                headers: {
                    Authorization: `Bearer ${tokens.accessToken}`,
                },
            }, 'Failed to load Facebook profile.');
            profile = validateFacebookProfile(profile);
            return {
                provider: 'facebook',
                account: createAccount('facebook', profile.id),
                profile,
                tokens,
            };
        },
    });
}
function createAccount(provider, providerAccountId) {
    return { provider, providerAccountId };
}
function validateFacebookProfile(profile) {
    if (typeof profile.id !== 'string' || profile.id.length === 0) {
        throw new Error('Facebook profile did not include a valid id.');
    }
    return profile;
}
function toURLString(value) {
    return typeof value === 'string' ? value : value.toString();
}
