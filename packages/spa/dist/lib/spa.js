import { renderWith } from '@remix-run/render-middleware';
import { run as runRuntime, spaResponse, } from '@remix-run/ui';
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const maxRedirects = 10;
/**
 * Creates middleware that exposes `context.render()` for SPA route responses.
 *
 * @param transform Optional transform that wraps or replaces route nodes.
 * @returns Middleware that installs the SPA renderer on request context.
 */
export function render(transform) {
    return renderWith((context) => function render(node, init) {
        return spaResponse.create(transform ? transform(node, context) : node, init);
    });
}
/**
 * Starts a client-rendered Remix application for the current document.
 *
 * The current URL and subsequent same-origin navigations are dispatched through `router`. Route
 * handlers return responses created by the {@link render} middleware, and their associated nodes
 * are rendered into the document's top frame.
 *
 * @param router Router that resolves browser requests to SPA route responses.
 * @param options Options for the initial render.
 * @returns The running application runtime.
 */
export function run(router, options = {}) {
    let app = runRuntime({
        loadModule() {
            throw new Error('SPA responses cannot hydrate client entries');
        },
        async resolveFrame(src, options) {
            let url = new URL(src, document.baseURI);
            let { response, redirectedTo } = await followFrameRedirects(router, url, {
                method: options?.method,
                body: getRequestBody(options),
                signal: options?.signal,
            });
            return spaResponse.finalize(response, redirectedTo);
        },
    });
    let readyPromise = app.ready().then(async () => {
        if (options.fallback !== undefined) {
            await app.frames.top.replace(options.fallback);
        }
        await app.frames.top.reload();
    });
    return Object.assign(app, {
        ready: () => readyPromise,
    });
}
async function followFrameRedirects(router, url, init) {
    let initialOrigin = url.origin;
    let method = init.method?.toUpperCase() ?? 'GET';
    let body = init.body;
    let redirectedTo;
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
        let response = await router.fetch(url, { ...init, method, body });
        if (!redirectStatuses.has(response.status)) {
            return { response, redirectedTo };
        }
        let location = response.headers.get('Location');
        if (!location)
            return { response };
        if (redirectCount === maxRedirects) {
            throw new TypeError(`SPA route exceeded ${maxRedirects} redirects`);
        }
        let nextUrl = new URL(location, url);
        if (nextUrl.origin !== initialOrigin) {
            throw new TypeError('SPA routes cannot redirect to another origin');
        }
        if ((response.status === 303 && method !== 'GET' && method !== 'HEAD') ||
            ((response.status === 301 || response.status === 302) && method === 'POST')) {
            method = 'GET';
            body = undefined;
        }
        url = nextUrl;
        redirectedTo = url.href;
    }
    throw new TypeError(`SPA route exceeded ${maxRedirects} redirects`);
}
// Frame reloads can receive raw FormData without going through form navigation. Encode it here so
// manual reloads use the requested form encoding instead of always sending multipart bodies.
function getRequestBody(options) {
    let formData = options?.formData;
    let method = options?.method;
    if (!formData || !method || ['get', 'head'].includes(method.toLowerCase()))
        return;
    let encType = options?.encType;
    if (encType === 'text/plain') {
        let body = '';
        for (let [name, value] of formData) {
            name = normalizeLineBreaks(name);
            value = normalizeLineBreaks(typeof value === 'string' ? value : value.name);
            body += `${name}=${value}\r\n`;
        }
        return new Blob([body], { type: 'text/plain' });
    }
    if (encType !== 'application/x-www-form-urlencoded')
        return formData;
    let body = new URLSearchParams();
    for (let [name, value] of formData) {
        body.append(name, typeof value === 'string' ? value : value.name);
    }
    return body;
}
function normalizeLineBreaks(value) {
    return value.replace(/\r\n|\r|\n/g, '\r\n');
}
