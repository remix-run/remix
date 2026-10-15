/**
 * Creates a credentials provider for direct form-based authentication.
 *
 * @param options Options for parsing submitted credentials and verifying them.
 * @returns A provider that can be passed to `verifyCredentials()`.
 */
export function createCredentialsAuthProvider(options) {
    return {
        name: options.name ?? 'password',
        parse: options.parse,
        verify: options.verify,
    };
}
