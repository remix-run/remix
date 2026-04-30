import { getOAuthProviderRuntime } from "./provider.js";
import { getRequiredSearchParam, getSession } from "./utils.js";
/**
 * Finishes an OAuth or OIDC callback flow for an external provider.
 *
 * @param provider The external provider that initiated the login flow.
 * @param context The current request context.
 * @param options Transaction lookup settings.
 * @returns The normalized provider result plus the preserved `returnTo` target, when available.
 */
export async function finishExternalAuth(provider, context, options = {}) {
    let session;
    let transactionKey = options.transactionKey ?? '__auth';
    let transaction;
    try {
        session = getSession(context, 'finishExternalAuth()');
        transaction = session.get(transactionKey);
        let callbackError = context.url.searchParams.get('error');
        if (callbackError != null) {
            let description = context.url.searchParams.get('error_description');
            throw new Error(description ?? callbackError);
        }
        if (transaction == null || transaction.provider !== provider.name) {
            throw new Error(`Missing OAuth transaction for "${provider.name}".`);
        }
        let state = getRequiredSearchParam(context, 'state');
        if (state !== transaction.state) {
            throw new Error('Invalid OAuth state.');
        }
        let result = await getOAuthProviderRuntime(provider).handleCallback(context, transaction);
        session.unset(transactionKey);
        return {
            result,
            returnTo: transaction.returnTo,
        };
    }
    catch (error) {
        if (session?.has(transactionKey)) {
            session.unset(transactionKey);
        }
        throw error;
    }
}
