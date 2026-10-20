/**
 * Verifies submitted credentials with a credentials auth provider.
 *
 * @param provider The credentials provider that parses and verifies the submitted input.
 * @param context The current request context.
 * @returns The authenticated result when verification succeeds, or `null` when the credentials are rejected.
 */
export async function verifyCredentials(provider, context) {
    let input = await provider.parse(context);
    return provider.verify(input, context);
}
