import type { RequestContext } from '@remix-run/fetch-router'

/**
 * Public shape for a credentials-based provider used by `createCredentialsAuthLoginRequestHandler()`.
 */
export interface CredentialsAuthProvider<input, result, provider extends string = string> {
  /** Provider name used for session metadata and diagnostics. */
  name: provider
  /** Parses submitted credentials from the current request. */
  parse(context: RequestContext): input | Promise<input>
  /** Verifies parsed credentials and returns the authenticated result on success. */
  verify(input: input, context: RequestContext): result | null | Promise<result | null>
}

/**
 * Options for building a credentials-based auth provider.
 */
export interface CredentialsAuthProviderOptions<
  input,
  result,
  provider extends string = 'password',
> {
  /** Provider name used for session metadata and diagnostics. */
  name?: provider
  /** Parses submitted credentials from the current request. */
  parse(context: RequestContext): input | Promise<input>
  /** Verifies parsed credentials and returns the authenticated result on success. */
  verify(input: input, context: RequestContext): result | null | Promise<result | null>
}

/**
 * Creates a credentials provider for direct form-based authentication.
 *
 * @param options Options for parsing submitted credentials and verifying them.
 * @returns A provider that can be passed to `createCredentialsAuthLoginRequestHandler()`.
 */
export function createCredentialsAuthProvider<input, result, provider extends string = 'password'>(
  options: CredentialsAuthProviderOptions<input, result, provider>,
): CredentialsAuthProvider<input, result, provider> {
  return {
    name: options.name ?? ('password' as provider),
    parse: options.parse,
    verify: options.verify,
  }
}
