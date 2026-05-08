import { Vary } from '@remix-run/headers';
const defaultCorsMethods = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];
/**
 * Middleware that adds CORS headers and handles CORS preflight requests.
 *
 * @param options CORS options
 * @returns CORS middleware
 */
export function cors(options = {}) {
    let methods = normalizeMethodList(options.methods ?? defaultCorsMethods);
    let exposedHeaders = options.exposedHeaders ? normalizeHeaderList(options.exposedHeaders) : '';
    let allowCredentials = options.credentials ?? false;
    let preflightContinue = options.preflightContinue ?? false;
    let preflightStatusCode = options.preflightStatusCode ?? 204;
    return async (context, next) => {
        let requestOrigin = context.headers.get('Origin');
        let preflightRequest = isPreflightRequest(context);
        if (requestOrigin == null) {
            if (preflightRequest && !preflightContinue) {
                return new Response(null, { status: preflightStatusCode });
            }
            return next();
        }
        let allowedOrigin = await resolveAllowedOrigin(requestOrigin, context, options.origin);
        if (allowedOrigin == null) {
            if (preflightRequest && !preflightContinue) {
                return new Response(null, { status: 403 });
            }
            return next();
        }
        let corsHeaders = new Headers();
        let vary = new Vary();
        let allowOriginHeader = allowedOrigin;
        if (allowCredentials && allowedOrigin === '*') {
            allowOriginHeader = requestOrigin;
        }
        corsHeaders.set('Access-Control-Allow-Origin', allowOriginHeader);
        if (allowOriginHeader !== '*') {
            vary.add('Origin');
        }
        if (allowCredentials) {
            corsHeaders.set('Access-Control-Allow-Credentials', 'true');
        }
        if (preflightRequest) {
            corsHeaders.set('Access-Control-Allow-Methods', methods);
            vary.add('Access-Control-Request-Method');
            let allowedHeaders = await resolveAllowedHeaders(context, options.allowedHeaders);
            if (allowedHeaders.headerValue != null) {
                corsHeaders.set('Access-Control-Allow-Headers', allowedHeaders.headerValue);
            }
            if (allowedHeaders.varyOnRequestHeaders) {
                vary.add('Access-Control-Request-Headers');
            }
            if (options.maxAge != null) {
                let maxAge = Math.max(0, Math.floor(options.maxAge));
                corsHeaders.set('Access-Control-Max-Age', String(maxAge));
            }
            if (options.allowPrivateNetwork &&
                context.headers.get('Access-Control-Request-Private-Network')?.toLowerCase() === 'true') {
                corsHeaders.set('Access-Control-Allow-Private-Network', 'true');
                vary.add('Access-Control-Request-Private-Network');
            }
            if (!preflightContinue) {
                if (vary.size > 0) {
                    corsHeaders.set('Vary', vary.toString());
                }
                return new Response(null, {
                    status: preflightStatusCode,
                    headers: corsHeaders,
                });
            }
        }
        else if (exposedHeaders !== '') {
            corsHeaders.set('Access-Control-Expose-Headers', exposedHeaders);
        }
        let response = await next();
        return withCorsHeaders(response, corsHeaders, vary);
    };
}
function isPreflightRequest(context) {
    return context.method === 'OPTIONS' && context.headers.has('Access-Control-Request-Method');
}
function normalizeMethodList(methods) {
    let normalized = [];
    for (let method of methods) {
        let value = method.trim().toUpperCase();
        if (value === '') {
            continue;
        }
        if (normalized.includes(value)) {
            continue;
        }
        normalized.push(value);
    }
    return normalized.join(', ');
}
function normalizeHeaderList(headerNames) {
    let normalized = [];
    for (let headerName of headerNames) {
        let value = headerName.trim();
        if (value === '') {
            continue;
        }
        let duplicate = normalized.some((existing) => existing.toLowerCase() === value.toLowerCase());
        if (duplicate) {
            continue;
        }
        normalized.push(value);
    }
    return normalized.join(', ');
}
async function resolveAllowedOrigin(requestOrigin, context, configuredOrigin) {
    let origin = configuredOrigin ?? '*';
    if (typeof origin === 'function') {
        let result = await origin(requestOrigin, context);
        return normalizeResolvedOrigin(result, requestOrigin);
    }
    if (origin === true) {
        return requestOrigin;
    }
    if (origin === false) {
        return null;
    }
    if (typeof origin === 'string') {
        if (origin === '*') {
            return '*';
        }
        return origin === requestOrigin ? requestOrigin : null;
    }
    if (origin instanceof RegExp) {
        return matchesOriginPattern(origin, requestOrigin) ? requestOrigin : null;
    }
    for (let allowed of origin) {
        if (allowed === '*') {
            return '*';
        }
        if (typeof allowed === 'string' && allowed === requestOrigin) {
            return requestOrigin;
        }
        if (allowed instanceof RegExp && matchesOriginPattern(allowed, requestOrigin)) {
            return requestOrigin;
        }
    }
    return null;
}
function matchesOriginPattern(pattern, requestOrigin) {
    let normalizedPattern = new RegExp(pattern.source, pattern.flags);
    return normalizedPattern.test(requestOrigin);
}
function normalizeResolvedOrigin(resolved, requestOrigin) {
    if (resolved == null || resolved === false) {
        return null;
    }
    if (resolved === true) {
        return requestOrigin;
    }
    if (resolved === '*') {
        return '*';
    }
    return resolved;
}
async function resolveAllowedHeaders(context, configuredAllowedHeaders) {
    if (Array.isArray(configuredAllowedHeaders)) {
        let headerValue = normalizeHeaderList(configuredAllowedHeaders);
        return {
            headerValue: headerValue === '' ? null : headerValue,
            varyOnRequestHeaders: false,
        };
    }
    if (typeof configuredAllowedHeaders === 'function') {
        let resolved = await configuredAllowedHeaders(context.request, context);
        if (resolved != null) {
            let headerValue = normalizeHeaderList(resolved);
            return {
                headerValue: headerValue === '' ? null : headerValue,
                varyOnRequestHeaders: true,
            };
        }
        let requestedHeaders = context.headers.get('Access-Control-Request-Headers');
        if (requestedHeaders == null || requestedHeaders.trim() === '') {
            return {
                headerValue: null,
                varyOnRequestHeaders: true,
            };
        }
        return {
            headerValue: requestedHeaders,
            varyOnRequestHeaders: true,
        };
    }
    let requestedHeaders = context.headers.get('Access-Control-Request-Headers');
    if (requestedHeaders == null || requestedHeaders.trim() === '') {
        return {
            headerValue: null,
            varyOnRequestHeaders: false,
        };
    }
    return {
        headerValue: requestedHeaders,
        varyOnRequestHeaders: true,
    };
}
function withCorsHeaders(response, corsHeaders, vary) {
    let responseHeaders = new Headers(response.headers);
    for (let [headerName, headerValue] of corsHeaders) {
        responseHeaders.set(headerName, headerValue);
    }
    if (vary.size > 0) {
        let responseVary = Vary.from(responseHeaders.get('Vary'));
        vary.forEach((headerName) => responseVary.add(headerName));
        responseHeaders.set('Vary', responseVary.toString());
    }
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
    });
}
