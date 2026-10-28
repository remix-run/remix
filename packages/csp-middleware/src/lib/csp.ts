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

/** Policy and response configuration for CSP middleware. */
export interface CspOptions {
  /** A static policy or a factory evaluated before downstream handlers run. */
  policy: CspPolicy | CspPolicyFactory
  /** Send Content-Security-Policy-Report-Only instead of an enforcing header (default false). */
  reportOnly?: boolean
  /**
   * Named URLs to add to `Reporting-Endpoints` on responses accepted by `filter`.
   * Reference a name with the policy's `reportTo` directive. Relative URLs are supported.
   * Existing endpoint names are preserved unless configured here with a different URL.
   * Names must be structured field keys; URLs must contain only printable ASCII characters.
   */
  reportingEndpoints?: Readonly<Record<string, string>>
  /**
   * Select responses that receive this policy (default `text/html` responses).
   * Overrides the default HTML filter; 304 responses are always returned unchanged.
   * Runs after downstream handlers, before adding policy and reporting endpoint headers.
   * Returning false preserves the original response. The nonce and policy are still
   * established before downstream handlers run.
   */
  filter?: (response: Response) => boolean
}

type CheckedPolicy<policy> = policy extends (...args: never[]) => infer result
  ? (
      context: CspPolicyContext,
    ) => CheckedPolicy<Awaited<result>> | Promise<CheckedPolicy<Awaited<result>>>
  : policy extends string | ContentSecurityPolicy
    ? policy
    : policy extends ContentSecurityPolicyInit
      ? policy & Record<Exclude<keyof policy, keyof ContentSecurityPolicyInit>, never>
      : never

// Keep valid options unchanged so callback return values retain their contextual checks.
type CheckedOptions<policy extends CspOptions['policy']> = Omit<CspOptions, 'policy'> & {
  policy: policy
} & ([policy] extends [CheckedPolicy<policy>] ? unknown : { policy: CheckedPolicy<policy> })

/**
 * Establishes a request nonce and appends a CSP to HTML responses by default.
 * Inferred directive objects and factory returns are checked for unknown directive keys.
 * Supply `filter` to select other response types, such as worker scripts.
 * Not-modified (304) responses are returned unchanged to preserve cached nonce policies.
 * Existing policies retain their enforcement or reporting mode. No default directives are added.
 * @param options The required policy and optional response configuration.
 * @returns Middleware providing the nonce read by `getCspNonce()` and the CSP response header.
 */
export function csp<policy extends CspOptions['policy']>(
  options: CheckedOptions<policy>,
): Middleware<{ key: typeof CspNonce; value: string }> {
  let { policy, filter = isHtmlResponse }: CspOptions = options
  let reportingEndpoints = serializeReportingEndpoints(options.reportingEndpoints ?? {})
  let headerName = options.reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy'
  let staticPolicy =
    typeof policy === 'function' ? undefined : ContentSecurityPolicy.from(policy).toString()

  return async (context, next) => {
    let nonce = getCspNonce(context) ?? createNonce()
    context.set(CspNonce, nonce)
    let header =
      typeof policy === 'function'
        ? ContentSecurityPolicy.from(await policy({ nonce, context })).toString()
        : staticPolicy
    let response = await next()
    if (!filter(response)) return response
    // A 304 updates cached headers while reusing the body; a fresh CSP nonce would mismatch it.
    // https://www.rfc-editor.org/rfc/rfc9111.html#section-4.3.4
    if (response.status === 304) return response

    let headers = new Headers(response.headers)
    if (header) headers.append(headerName, header)
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
