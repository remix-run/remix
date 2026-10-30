import { ContentSecurityPolicy, } from '@remix-run/headers/content-security-policy';
import { CspNonce, getCspNonce } from './nonce.js';
/**
 * Establishes a request nonce and appends the configured CSPs to HTML responses by default.
 * `policy` is enforced and `reportOnlyPolicy` is monitored; either or both may be given.
 * Override `filter` for other response types; 304 responses are always unchanged.
 * Existing policies are preserved separately. Inferred policies reject unknown directive keys.
 * @param options The enforced and/or report-only policy and optional response configuration.
 * @returns Middleware providing the nonce read by `getCspNonce()` and the CSP response headers.
 */
export function csp(options) {
    let { filter = isHtmlResponse } = options;
    if (options.policy === undefined && options.reportOnlyPolicy === undefined) {
        throw new TypeError('csp() requires policy, reportOnlyPolicy, or both');
    }
    let enforced = createPolicySerializer(options.policy);
    let reportOnly = createPolicySerializer(options.reportOnlyPolicy);
    let reportingEndpoints = serializeReportingEndpoints(options.reportingEndpoints ?? {});
    return async (context, next) => {
        let nonce = getCspNonce(context) ?? createNonce();
        context.set(CspNonce, nonce);
        let enforcedHeader = await enforced?.({ nonce, context });
        let reportOnlyHeader = await reportOnly?.({ nonce, context });
        let response = await next();
        if (!filter(response))
            return response;
        // A 304 updates cached headers while reusing the body; a fresh CSP nonce would mismatch it.
        // https://www.rfc-editor.org/rfc/rfc9111.html#section-4.3.4
        if (response.status === 304)
            return response;
        let headers = new Headers(response.headers);
        if (enforcedHeader)
            headers.append('Content-Security-Policy', enforcedHeader);
        if (reportOnlyHeader)
            headers.append('Content-Security-Policy-Report-Only', reportOnlyHeader);
        if (reportingEndpoints) {
            let existing = headers.get('Reporting-Endpoints')?.trim();
            // Structured field dictionaries use the last value for duplicate endpoint names.
            headers.set('Reporting-Endpoints', existing ? `${existing}, ${reportingEndpoints}` : reportingEndpoints);
        }
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    };
}
function createPolicySerializer(policy) {
    if (policy === undefined)
        return undefined;
    if (typeof policy === 'function') {
        return async (context) => ContentSecurityPolicy.from(await policy(context)).toString();
    }
    let serialized = ContentSecurityPolicy.from(policy).toString();
    return () => serialized;
}
function isHtmlResponse(response) {
    return (response.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase() === 'text/html');
}
function serializeReportingEndpoints(endpoints) {
    return Object.entries(endpoints)
        .map(([name, url]) => {
        if (!/^[a-z*][a-z0-9_.*-]*$/.test(name)) {
            throw new TypeError(`Invalid reporting endpoint name: ${JSON.stringify(name)}`);
        }
        if (/[^\x20-\x7e]/.test(url)) {
            throw new TypeError(`Invalid reporting endpoint URL for ${name}: use printable ASCII or percent-encoding`);
        }
        return `${name}=${JSON.stringify(url)}`;
    })
        .join(', ');
}
function createNonce() {
    let bytes = crypto.getRandomValues(new Uint8Array(16));
    return btoa(String.fromCharCode(...bytes));
}
