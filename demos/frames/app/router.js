import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { createRouter } from 'remix/fetch-router';
import { logger } from 'remix/logger-middleware';
import { staticFiles } from 'remix/static-middleware';
import { renderToStream } from 'remix/component/server';
import { Frame } from 'remix/component';
import { routes } from './routes.js';
import { Counter } from './assets/counter.js';
import { ReloadTime } from './assets/reload-time.js';
import { ReloadScope } from './assets/reload-scope.js';
import { ClientFrameExample } from './assets/client-frame-example.js';
import { ClientMountedPageExample } from './assets/client-mounted-page-example.js';
import { StateSearchPage } from './assets/state-search-page.js';
import { searchUnitedStates } from './us-states.js';
let middleware = [];
if (process.env.NODE_ENV === 'development') {
    middleware.push(logger());
}
middleware.push(staticFiles('./public', {
    cacheControl: 'no-store',
    etag: false,
    lastModified: false,
    index: false,
}));
export let router = createRouter({ middleware });
function App() {
    return () => (_jsxs("html", { children: [_jsxs("head", { children: [_jsx("meta", { charSet: "utf-8" }), _jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }), _jsx("title", { children: "Frames + fetch-router demo" }), _jsx("script", { async: true, type: "module", src: "/assets/entry.js" })] }), _jsx("body", { style: {
                    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
                    margin: 0,
                    padding: 24,
                    background: '#0b1020',
                    color: '#e9eefc',
                }, children: _jsxs("div", { style: { maxWidth: 980, margin: '0 auto' }, children: [_jsx("h1", { style: { margin: 0, letterSpacing: '-0.02em' }, children: "Full-stack Frames" }), _jsxs("p", { style: { marginTop: 8, color: '#b9c6ff' }, children: ["Server routes are handled by ", _jsx("code", { children: "remix/fetch-router" }), "; UI is streamed with", ' ', _jsx("code", { children: "remix/component" }), " Frames and client entries."] }), _jsxs("p", { style: { marginTop: 0, marginBottom: 16 }, children: [_jsx("a", { href: "/time", style: { color: '#b9c6ff', textDecoration: 'underline' }, children: "Server time demo" }), ' · ', _jsx("a", { href: "/reload-scope", style: { color: '#b9c6ff', textDecoration: 'underline' }, children: "Frame vs top reload demo" }), ' · ', _jsx("a", { href: "/state-search", style: { color: '#b9c6ff', textDecoration: 'underline' }, children: "Dynamic src search demo" }), ' · ', _jsx("a", { href: "/client-mounted", style: { color: '#b9c6ff', textDecoration: 'underline' }, children: "Client-mounted nested frame demo" })] }), _jsxs("div", { style: {
                                display: 'grid',
                                gridTemplateColumns: '320px 1fr',
                                gap: 16,
                                alignItems: 'start',
                                marginTop: 24,
                            }, children: [_jsxs("aside", { style: {
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        borderRadius: 12,
                                        padding: 16,
                                        background: 'rgba(255,255,255,0.04)',
                                    }, children: [_jsx("h2", { style: { marginTop: 0, fontSize: 16 }, children: "Sidebar (Frame)" }), _jsx(Frame, { src: "/frames/sidebar", fallback: _jsx("div", { style: { color: '#9aa8e8' }, children: "Loading sidebar\u2026" }) })] }), _jsxs("main", { style: {
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        borderRadius: 12,
                                        padding: 16,
                                        background: 'rgba(255,255,255,0.04)',
                                    }, children: [_jsx("h2", { style: { marginTop: 0, fontSize: 16 }, children: "Main" }), _jsx("p", { style: { color: '#b9c6ff', marginTop: 0 }, children: "The counter below is a client entry." }), _jsx(Counter, { setup: 0, label: "Clicks" }), _jsx(ClientFrameExample, {}), _jsx("div", { style: { height: 16 } }), _jsx("h3", { style: { margin: 0, fontSize: 14, color: '#cfd8ff' }, children: "Activity (Frame)" }), _jsx(Frame, { src: "/frames/activity", fallback: _jsx("div", { style: { color: '#9aa8e8' }, children: "Loading activity\u2026" }) })] })] })] }) })] }));
}
router.get(routes.home, async (context) => {
    let stream = renderToStream(_jsx(App, {}), {
        resolveFrame: (src) => resolveFrameViaRouter(context.request, src),
        onError(error) {
            console.error(error);
        },
    });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
});
router.get(routes.clientMounted, async (context) => {
    function ClientMountedPage() {
        return () => (_jsxs("html", { children: [_jsxs("head", { children: [_jsx("meta", { charSet: "utf-8" }), _jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }), _jsx("title", { children: "Client-mounted nested frame" }), _jsx("script", { async: true, type: "module", src: "/assets/entry.js" })] }), _jsx("body", { style: {
                        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
                        margin: 0,
                        padding: 24,
                        background: '#0b1020',
                        color: '#e9eefc',
                    }, children: _jsxs("div", { style: { maxWidth: 760, margin: '0 auto' }, children: [_jsx("a", { href: "/", style: { color: '#b9c6ff', textDecoration: 'underline' }, children: "\u2190 Back" }), _jsx("h1", { style: { marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em' }, children: "Client-mounted nested non-blocking frame" }), _jsx("p", { style: { marginTop: 0, color: '#b9c6ff' }, children: "Mount the outer frame, then watch the nested frame fallback render before its server content streams in." }), _jsx(ClientMountedPageExample, {})] }) })] }));
    }
    let stream = renderToStream(_jsx(ClientMountedPage, {}), {
        resolveFrame: (src) => resolveFrameViaRouter(context.request, src),
        onError(error) {
            console.error(error);
        },
    });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
});
router.get(routes.time, async (context) => {
    function TimePage() {
        return () => (_jsxs("html", { children: [_jsxs("head", { children: [_jsx("meta", { charSet: "utf-8" }), _jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }), _jsx("title", { children: "Server time" }), _jsx("script", { async: true, type: "module", src: "/assets/entry.js" })] }), _jsx("body", { style: {
                        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
                        margin: 0,
                        padding: 24,
                        background: '#0b1020',
                        color: '#e9eefc',
                    }, children: _jsxs("div", { style: { maxWidth: 720, margin: '0 auto' }, children: [_jsx("a", { href: "/", style: { color: '#b9c6ff', textDecoration: 'underline' }, children: "\u2190 Back" }), _jsx("h1", { style: { marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em' }, children: "Server time (Frame reload)" }), _jsxs("p", { style: { marginTop: 0, color: '#b9c6ff' }, children: ["The frame below renders the current server time. Click \u201CRefresh\u201D to call", ' ', _jsx("code", { children: "frame.reload()" }), " from a client entry inside the frame."] }), _jsx("div", { style: {
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 12,
                                    padding: 16,
                                    background: 'rgba(255,255,255,0.04)',
                                }, children: _jsx(Frame, { src: routes.frames.time.href(), fallback: _jsx("div", { style: { color: '#9aa8e8' }, children: "Loading server time\u2026" }) }) })] }) })] }));
    }
    let stream = renderToStream(_jsx(TimePage, {}), {
        resolveFrame: (src) => resolveFrameViaRouter(context.request, src),
        onError(error) {
            console.error(error);
        },
    });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
});
router.get(routes.reloadScope, async (context) => {
    function ReloadScopePage() {
        let pageNow = new Date();
        return () => (_jsxs("html", { children: [_jsxs("head", { children: [_jsx("meta", { charSet: "utf-8" }), _jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }), _jsx("title", { children: "Frame vs top reload" }), _jsx("script", { async: true, type: "module", src: "/assets/entry.js" })] }), _jsx("body", { style: {
                        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
                        margin: 0,
                        padding: 24,
                        background: '#0b1020',
                        color: '#e9eefc',
                    }, children: _jsxs("div", { style: { maxWidth: 760, margin: '0 auto' }, children: [_jsx("a", { href: "/", style: { color: '#b9c6ff', textDecoration: 'underline' }, children: "\u2190 Back" }), _jsx("h1", { style: { marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em' }, children: "Frame reload vs top reload" }), _jsx("p", { style: { marginTop: 0, color: '#b9c6ff' }, children: "Reload only this frame, or reload the entire runtime tree from inside the same client entry." }), _jsxs("div", { style: { marginBottom: 10 }, children: [_jsx("div", { style: { fontSize: 13, color: '#b9c6ff' }, children: "Page server time" }), _jsx("div", { style: { fontSize: 20, fontVariantNumeric: 'tabular-nums' }, children: pageNow.toLocaleTimeString() })] }), _jsx("div", { style: {
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 12,
                                    padding: 16,
                                    background: 'rgba(255,255,255,0.04)',
                                }, children: _jsx(Frame, { src: routes.frames.reloadScope.href(), fallback: _jsx("div", { style: { color: '#9aa8e8' }, children: "Loading reload controls\u2026" }) }) })] }) })] }));
    }
    let stream = renderToStream(_jsx(ReloadScopePage, {}), {
        resolveFrame: (src) => resolveFrameViaRouter(context.request, src),
        onError(error) {
            console.error(error);
        },
    });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
});
router.get(routes.stateSearch, async (context) => {
    let url = new URL(context.request.url);
    let initialQuery = url.searchParams.get('query') ?? '';
    function StateSearchRoutePage() {
        return () => (_jsxs("html", { children: [_jsxs("head", { children: [_jsx("meta", { charSet: "utf-8" }), _jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }), _jsx("title", { children: "Dynamic Frame src search" }), _jsx("script", { async: true, type: "module", src: "/assets/entry.js" })] }), _jsx("body", { style: {
                        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
                        margin: 0,
                        padding: 24,
                        background: '#0b1020',
                        color: '#e9eefc',
                    }, children: _jsxs("div", { style: { maxWidth: 760, margin: '0 auto' }, children: [_jsx("a", { href: "/", style: { color: '#b9c6ff', textDecoration: 'underline' }, children: "\u2190 Back" }), _jsxs("h1", { style: { marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em' }, children: ["Dynamic ", _jsx("code", { children: '<Frame src>' }), " state search"] }), _jsxs("p", { style: { marginTop: 0, color: '#b9c6ff' }, children: ["Submit the form to update the frame ", _jsx("code", { children: "src" }), " query params and fetch matching U.S. states."] }), _jsx(StateSearchPage, { setup: initialQuery })] }) })] }));
    }
    let stream = renderToStream(_jsx(StateSearchRoutePage, {}), {
        resolveFrame: (src) => resolveFrameViaRouter(context.request, src),
        onError(error) {
            console.error(error);
        },
    });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
});
router.get(routes.frames.sidebar, async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    let stream = renderToStream(_jsxs("div", { children: [_jsxs("p", { style: { marginTop: 0, color: '#b9c6ff' }, children: ["This content is rendered by ", _jsx("code", { children: "/frames/sidebar" }), "."] }), _jsxs("ul", { style: { margin: 0, paddingLeft: '18px', color: '#e9eefc' }, children: [_jsx("li", { children: "Streams in after initial HTML" }), _jsx("li", { children: "Can contain client entries" }), _jsx("li", { children: "Can nest frames" })] })] }), { onError: console.error });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
});
router.get(routes.frames.activity, async (context) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    let stream = renderToStream(_jsxs("div", { children: [_jsxs("p", { style: { marginTop: 0, color: '#b9c6ff' }, children: ["Rendered by ", _jsx("code", { children: "/frames/activity" }), " at ", _jsx("time", { children: new Date().toLocaleTimeString() }), "."] }), _jsx(Frame, { src: routes.frames.activityDetail.href(), fallback: _jsx("div", { style: { color: '#9aa8e8' }, children: "Loading detail\u2026" }) })] }), {
        resolveFrame: (src) => resolveFrameViaRouter(context.request, src),
        onError: console.error,
    });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
});
router.get(routes.frames.activityDetail, async (context) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    let stream = renderToStream(_jsxs("div", { children: [_jsx("p", { style: { marginTop: 0, marginBottom: 8, color: '#9aa8e8' }, children: "Nested frame with a hydrated counter:" }), _jsx("div", { style: { marginTop: 12 }, children: _jsx(Frame, { src: routes.frames.time.href(), fallback: _jsx("div", { style: { color: '#9aa8e8' }, children: "Loading server time\u2026" }) }) })] }), {
        resolveFrame: (src) => resolveFrameViaRouter(context.request, src),
        onError: console.error,
    });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
});
router.get(routes.frames.clientFrameExample, async (context) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    let now = new Date();
    let stream = renderToStream(_jsxs("div", { style: {
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            padding: 10,
            background: 'rgba(255,255,255,0.02)',
        }, children: [_jsx("div", { style: { fontSize: 12, color: '#b9c6ff' }, children: "Server fragment from /frames/client-frame-example" }), _jsx("div", { style: { fontSize: 16, fontVariantNumeric: 'tabular-nums', marginTop: 2 }, children: now.toLocaleTimeString() }), _jsx("div", { style: { marginTop: 8 }, children: _jsx(Counter, { setup: 5, label: "Inside mounted frame" }) }), _jsxs("div", { style: { marginTop: 10 }, children: [_jsx("div", { style: { fontSize: 12, color: '#9aa8e8', marginBottom: 6 }, children: "Nested frame:" }), _jsx(Frame, { src: routes.frames.clientFrameExampleNested.href(), fallback: _jsx("div", { style: { color: '#9aa8e8' }, children: "Loading nested frame\u2026" }) })] })] }), {
        resolveFrame: (src) => resolveFrameViaRouter(context.request, src),
        onError: console.error,
    });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
});
router.get(routes.frames.clientFrameExampleNested, async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    let stream = renderToStream(_jsxs("div", { style: {
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8,
            padding: 8,
            background: 'rgba(255,255,255,0.02)',
        }, children: [_jsx("div", { style: { fontSize: 12, color: '#b9c6ff' }, children: "Nested server fragment" }), _jsx("div", { style: { marginTop: 6 }, children: _jsx(Counter, { setup: 1, label: "Nested frame counter" }) })] }), { onError: console.error });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
});
router.get(routes.frames.clientMountedOuter, async (context) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    let stream = renderToStream(_jsxs("div", { style: {
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            padding: 10,
            background: 'rgba(255,255,255,0.02)',
        }, children: [_jsx("div", { style: { fontSize: 12, color: '#b9c6ff' }, children: "Outer server fragment from /frames/client-mounted-outer" }), _jsx("div", { style: { marginTop: 8 }, children: _jsx(Counter, { setup: 2, label: "Outer frame counter" }) }), _jsxs("div", { style: { marginTop: 10 }, children: [_jsx("div", { style: { fontSize: 12, color: '#9aa8e8', marginBottom: 6 }, children: "Nested non-blocking frame:" }), _jsx(Frame, { src: routes.frames.clientMountedNested.href(), fallback: _jsx("div", { style: { color: '#9aa8e8' }, children: "Loading nested non-blocking frame\u2026" }) })] })] }), {
        resolveFrame: (src) => resolveFrameViaRouter(context.request, src),
        onError: console.error,
    });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
});
router.get(routes.frames.clientMountedNested, async () => {
    await new Promise((resolve) => setTimeout(resolve, 2200));
    let stream = renderToStream(_jsxs("div", { style: {
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8,
            padding: 8,
            background: 'rgba(255,255,255,0.02)',
        }, children: [_jsx("div", { style: { fontSize: 12, color: '#b9c6ff' }, children: "Nested server fragment" }), _jsx("div", { style: { fontSize: 16, marginTop: 2, fontVariantNumeric: 'tabular-nums' }, children: new Date().toLocaleTimeString() }), _jsx("div", { style: { marginTop: 6 }, children: _jsx(Counter, { setup: 3, label: "Nested frame counter" }) })] }), { onError: console.error });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
});
router.get(routes.frames.time, async () => {
    // Artificial delay so the frame fallback/pending UI is visible.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    let now = new Date();
    let stream = renderToStream(_jsx("div", { children: _jsxs("div", { style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
            }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, color: '#b9c6ff' }, children: "Server time" }), _jsx("div", { style: { fontSize: 18, fontVariantNumeric: 'tabular-nums' }, children: now.toLocaleTimeString() })] }), _jsx(Counter, { setup: 0, label: "In a frame" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: _jsx(ReloadTime, {}) })] }) }), { onError: console.error });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
});
router.get(routes.frames.reloadScope, async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    let now = new Date();
    let stream = renderToStream(_jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, color: '#b9c6ff' }, children: "Frame server time" }), _jsx("div", { style: { fontSize: 18, fontVariantNumeric: 'tabular-nums', marginBottom: 10 }, children: now.toLocaleTimeString() }), _jsx(ReloadScope, {})] }), { onError: console.error });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
});
router.get(routes.frames.stateSearchResults, async (context) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    let url = new URL(context.request.url);
    let query = (url.searchParams.get('query') ?? '').trim();
    let matches = searchUnitedStates(query);
    let stream = renderToStream(_jsxs("div", { children: [_jsx("p", { style: { marginTop: 0, marginBottom: 10, color: '#b9c6ff' }, children: query
                    ? `Results for "${query}" (${matches.length})`
                    : `Showing all states (${matches.length})` }), matches.length > 0 ? (_jsx("ul", { style: { margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }, children: matches.map((state) => (_jsx("li", { children: state }, state))) })) : (_jsx("p", { style: { margin: 0, color: '#9aa8e8' }, children: "No states matched that query." }))] }), { onError: console.error });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
});
async function resolveFrameViaRouter(request, src) {
    let url = new URL(src, request.url);
    // IMPORTANT: this is a server-internal fetch to get *HTML*, so do not forward
    // Accept-Encoding — otherwise compression middleware could return compressed bytes.
    let headers = new Headers(request.headers);
    headers.delete('accept-encoding');
    headers.set('accept', 'text/html');
    let res = await router.fetch(new Request(url, {
        method: 'GET',
        headers,
        signal: request.signal,
    }));
    if (!res.ok) {
        return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`;
    }
    if (res.body) {
        return res.body;
    }
    return await res.text();
}
