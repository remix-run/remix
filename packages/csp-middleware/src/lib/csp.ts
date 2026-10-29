import type { Middleware, RequestContext } from '@remix-run/fetch-router'
import {
  ContentSecurityPolicy,
  type ContentSecurityPolicyInit,
} from '@remix-run/headers/content-security-policy'

import { CspNonce, getCspNonce } from './nonce.ts'

/** A single static CSP, either serialized or expressed as directives. */
export type CspPolicy = string | ContentSecurityPolicyInit | ContentSecurityPolicy

/** Values available while creating a request's policy, before downstream handlers run. */
export interface CspPolicyContext {
  /** Cryptographically random nonce, shared with internal renders of this document. */
  nonce: string
  /** Current router request context. */
  context: RequestContext
}

/** Creates a policy using the current request's nonce and context. */
export type CspPolicyFactory = (context: CspPolicyContext) => CspPolicy | Promise<CspPolicy>

interface CspOptionFields {
  /** Enforced policy sent as `Content-Security-Policy`, static or a factory run before handlers. */
  policy?: CspPolicy | CspPolicyFactory
  /**
   * Policy sent as `Content-Security-Policy-Report-Only`, static or a factory run before handlers.
   * Browsers monitor it alongside `policy`, so stricter directives can be trialled while the
   * enforced policy stays in place. Both policies share the request nonce.
   */
  reportOnly?: CspPolicy | CspPolicyFactory
  /**
   * Named absolute or relative URLs for `Reporting-Endpoints`, referenced by `reportTo`.
   * Configured names override matching downstream entries; other entries are preserved.
   * Names must be structured field keys; URLs must contain only printable ASCII characters.
   */
  reportingEndpoints?: Readonly<Record<string, string>>
  /**
   * Select responses for policy and reporting headers (default `text/html` responses).
   * Runs after downstream handlers; returning false preserves the response.
   * Nonce and policy creation still run before handlers. 304 responses are always unchanged.
   */
  filter?: (response: Response) => boolean
}

type CspPolicyOption = CspPolicy | CspPolicyFactory

/** Policy and response configuration for CSP middleware. Provide `policy`, `reportOnly`, or both. */
export type CspOptions = CspOptionFields &
  ({ policy: CspPolicyOption } | { reportOnly: CspPolicyOption })

// Only require the key here: typed members would change the contextual type of factory returns.
type RequiredPolicy = { policy: unknown } | { reportOnly: unknown }

type CheckedPolicy<policy> = policy extends undefined
  ? undefined
  : policy extends (...args: never[]) => infer result
    ? (
        context: CspPolicyContext,
      ) => CheckedPolicy<Awaited<result>> | Promise<CheckedPolicy<Awaited<result>>>
    : policy extends string | ContentSecurityPolicy
      ? policy
      : policy extends ContentSecurityPolicyInit
        ? policy & Record<Exclude<keyof policy, keyof ContentSecurityPolicyInit>, never>
        : never

// Keep valid options unchanged so callback return values retain their contextual checks.
type CheckedOptions<
  policy extends CspPolicyOption | undefined,
  reportOnly extends CspPolicyOption | undefined,
> = Omit<CspOptionFields, 'policy' | 'reportOnly'> & {
  policy?: policy
  reportOnly?: reportOnly
} & ([policy] extends [CheckedPolicy<policy>] ? unknown : { policy: CheckedPolicy<policy> }) &
  ([reportOnly] extends [CheckedPolicy<reportOnly>]
    ? unknown
    : { reportOnly: CheckedPolicy<reportOnly> }) &
  RequiredPolicy

/**
 * Establishes a request nonce and appends the configured CSPs to HTML responses by default.
 * `policy` is enforced and `reportOnly` is monitored; either or both may be given.
 * Override `filter` for other response types; 304 responses are always unchanged.
 * Existing policies are preserved separately. Inferred policies reject unknown directive keys.
 * @param options The enforced and/or report-only policy and optional response configuration.
 * @returns Middleware providing the nonce read by `getCspNonce()` and the CSP response headers.
 */
export function csp<
  policy extends CspPolicyOption | undefined,
  reportOnly extends CspPolicyOption | undefined,
>(
  options: CheckedOptions<policy, reportOnly>,
): Middleware<{ key: typeof CspNonce; value: string }> {
  let { filter = isHtmlResponse }: CspOptionFields = options
  if (options.policy === undefined && options.reportOnly === undefined) {
    throw new TypeError('csp() requires a policy, a reportOnly policy, or both')
  }
  let enforced = createPolicySerializer(options.policy)
  let reportOnly = createPolicySerializer(options.reportOnly)
  let reportingEndpoints = serializeReportingEndpoints(options.reportingEndpoints ?? {})

  return async (context, next) => {
    let nonce = getCspNonce(context) ?? createNonce()
    context.set(CspNonce, nonce)
    let enforcedHeader = await enforced?.({ nonce, context })
    let reportOnlyHeader = await reportOnly?.({ nonce, context })
    let response = await next()
    if (!filter(response)) return response
    // A 304 updates cached headers while reusing the body; a fresh CSP nonce would mismatch it.
    // https://www.rfc-editor.org/rfc/rfc9111.html#section-4.3.4
    if (response.status === 304) return response

    let headers = new Headers(response.headers)
    if (enforcedHeader) headers.append('Content-Security-Policy', enforcedHeader)
    if (reportOnlyHeader) headers.append('Content-Security-Policy-Report-Only', reportOnlyHeader)
    if (reportingEndpoints) {
      let existing = headers.get('Reporting-Endpoints')?.trim()
      // Structured field dictionaries use the last value for duplicate endpoint names.
      headers.set(
        'Reporting-Endpoints',
        existing ? `${existing}, ${reportingEndpoints}` : reportingEndpoints,
      )
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}

function createPolicySerializer(
  policy: CspPolicyOption | undefined,
): ((context: CspPolicyContext) => string | Promise<string>) | undefined {
  if (policy === undefined) return undefined
  if (typeof policy === 'function') {
    return async (context) => ContentSecurityPolicy.from(await policy(context)).toString()
  }
  let serialized = ContentSecurityPolicy.from(policy).toString()
  return () => serialized
}

function isHtmlResponse(response: Response): boolean {
  return (
    response.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase() === 'text/html'
  )
}

function serializeReportingEndpoints(endpoints: Readonly<Record<string, string>>): string {
  return Object.entries(endpoints)
    .map(([name, url]) => {
      if (!/^[a-z*][a-z0-9_.*-]*$/.test(name)) {
        throw new TypeError(`Invalid reporting endpoint name: ${JSON.stringify(name)}`)
      }
      if (/[^\x20-\x7e]/.test(url)) {
        throw new TypeError(
          `Invalid reporting endpoint URL for ${name}: use printable ASCII or percent-encoding`,
        )
      }
      return `${name}=${JSON.stringify(url)}`
    })
    .join(', ')
}

function createNonce(): string {
  let bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}
