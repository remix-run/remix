import type { RequestContext } from '@remix-run/fetch-router'

import type { CredentialsProvider } from './types.ts'

export interface CredentialsOptions<input, result, provider extends string = 'password'> {
  name?: provider
  parse(context: RequestContext): input | Promise<input>
  verify(input: input, context: RequestContext): result | null | Promise<result | null>
}

export function credentials<input, result, provider extends string = 'password'>(
  options: CredentialsOptions<input, result, provider>,
): CredentialsProvider<input, result, provider> {
  return {
    kind: 'credentials',
    name: options.name ?? ('password' as provider),
    parse: options.parse,
    verify: options.verify,
  }
}
