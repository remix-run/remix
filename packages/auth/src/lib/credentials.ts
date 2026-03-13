import type { RequestContext } from '@remix-run/fetch-router'

/**
 * Public shape for a credentials-based provider used by `login()`.
 */
export interface CredentialsProvider<input, result, provider extends string = string> {
  kind: 'credentials'
  name: provider
  parse(context: RequestContext): input | Promise<input>
  verify(input: input, context: RequestContext): result | null | Promise<result | null>
}

/**
 * Options for building a credentials-based auth provider.
 */
export interface CredentialsOptions<input, result, provider extends string = 'password'> {
  name?: provider
  parse(context: RequestContext): input | Promise<input>
  verify(input: input, context: RequestContext): result | null | Promise<result | null>
}

/**
 * Creates a credentials provider for direct form-based authentication.
 *
 * @param options Options for parsing submitted credentials and verifying them.
 * @returns A provider that can be passed to `login()`.
 */
export function createCredentialsAuthProvider<input, result, provider extends string = 'password'>(
  options: CredentialsOptions<input, result, provider>,
): CredentialsProvider<input, result, provider> {
  return {
    kind: 'credentials',
    name: options.name ?? ('password' as provider),
    parse: options.parse,
    verify: options.verify,
  }
}
