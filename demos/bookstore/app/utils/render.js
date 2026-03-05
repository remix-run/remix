import { renderToStream } from 'remix/component/server';
import { getContext } from 'remix/async-context-middleware';
export function render(node, init) {
    let context = getContext();
    let request = context.request;
    let router = context.router;
    let stream = renderToStream(node, {
        resolveFrame: (src) => resolveFrame(router, request, src),
        onError(error) {
            console.error(error);
        },
    });
    let headers = new Headers(init?.headers);
    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'text/html; charset=UTF-8');
    }
    return new Response(stream, { ...init, headers });
}
async function resolveFrame(router, request, src) {
    let url = new URL(src, request.url);
    let headers = new Headers();
    headers.set('accept', 'text/html');
    headers.set('accept-encoding', 'identity');
    let cookie = request.headers.get('cookie');
    if (cookie)
        headers.set('cookie', cookie);
    let res = await router.fetch(new Request(url, {
        method: 'GET',
        headers,
        signal: request.signal,
    }));
    if (!res.ok) {
        return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`;
    }
    if (res.body)
        return res.body;
    return res.text();
}
export function renderFragment(node, init) {
    let headers = new Headers(init?.headers);
    if (!headers.has('Cache-Control')) {
        headers.set('Cache-Control', 'no-store');
    }
    return render(node, { ...init, headers });
}
