import { getOAuthProviderRuntime } from "./provider.js";
import { createOAuthTransaction, createRedirectResponse, getSession, sanitizeReturnTo, } from "./utils.js";
/**
 * Starts an OAuth or OIDC login redirect flow for an external provider.
 *
 * @param provider The external provider to redirect to.
 * @param context The current request context.
 * @param options Transaction storage and optional return-to settings.
 * @returns A redirect response to the provider authorization URL.
 */
export async function startExternalAuth(provider, context, options = {}) {
    let session = getSession(context, 'startExternalAuth()');
    let transaction = createOAuthTransaction(provider.name, sanitizeReturnTo(options.returnTo ?? null));
    let authorizationURL = await getOAuthProviderRuntime(provider).createAuthorizationURL(transaction);
    session.set(options.transactionKey ?? '__auth', transaction);
    return createRedirectResponse(authorizationURL);
}
