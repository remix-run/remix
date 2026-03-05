import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "remix/component/jsx-runtime";
import { createRouter } from 'remix/fetch-router';
import { compression } from 'remix/compression-middleware';
import { logger } from 'remix/logger-middleware';
import { staticFiles } from 'remix/static-middleware';
import { css } from 'remix/component';
import { routes } from './routes.js';
import { MessageStream } from './assets/message-stream.js';
import { Layout } from './layout.js';
import { render } from './utils/render.js';
let middleware = [];
if (process.env.NODE_ENV === 'development') {
    middleware.push(logger());
}
middleware.push(compression());
middleware.push(staticFiles('./public', {
    cacheControl: 'no-store',
    etag: false,
    lastModified: false,
}));
export let router = createRouter({ middleware });
// The assets route is handled by the static files middleware above
let { assets, ...pageRoutes } = routes;
router.map(pageRoutes, {
    actions: {
        home(context) {
            let limitParam = context.url.searchParams.get('limit');
            let limit = limitParam ? parseInt(limitParam, 10) : null;
            if (!limit || !isFinite(limit))
                limit = null;
            return render(_jsxs(Layout, { children: [_jsx("h1", { mix: [css({ color: '#333', marginBottom: '0.5rem' })], children: "Server-Sent Events Demo" }), _jsx("p", { mix: [css({ color: '#666', marginBottom: '2rem' })], children: "Real-time updates with compression middleware" }), _jsxs("div", { mix: [
                            css({
                                background: 'white',
                                padding: '1.5rem',
                                borderRadius: '8px',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                                marginBottom: '1.5rem',
                            }),
                        ], children: [_jsx("label", { mix: [
                                    css({
                                        display: 'block',
                                        fontWeight: 600,
                                        marginBottom: '0.5rem',
                                        color: '#333',
                                    }),
                                ], children: "Compression:" }), _jsxs("div", { mix: [
                                    css({
                                        padding: '0.5rem',
                                        background: '#f8f9fa',
                                        borderRadius: '4px',
                                        color: '#666',
                                    }),
                                ], children: ["Encoding is negotiated automatically via", ' ', _jsx("code", { mix: [
                                            css({
                                                background: '#f5f5f5',
                                                padding: '0.2rem 0.4rem',
                                                borderRadius: '3px',
                                                fontFamily: "'Courier New', monospace",
                                                fontSize: '0.9em',
                                            }),
                                        ], children: "Accept-Encoding" }), ' ', "header.", _jsx("br", {}), "Open DevTools Network tab to see", ' ', _jsx("code", { mix: [
                                            css({
                                                background: '#f5f5f5',
                                                padding: '0.2rem 0.4rem',
                                                borderRadius: '3px',
                                                fontFamily: "'Courier New', monospace",
                                                fontSize: '0.9em',
                                            }),
                                        ], children: "Content-Encoding" }), ' ', "response header."] })] }), _jsxs("div", { mix: [
                            css({
                                background: 'white',
                                padding: '1.5rem',
                                borderRadius: '8px',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                                marginBottom: '1.5rem',
                            }),
                        ], children: [_jsx("label", { mix: [
                                    css({
                                        display: 'block',
                                        fontWeight: 600,
                                        marginBottom: '0.5rem',
                                        color: '#333',
                                    }),
                                ], children: "Message Limit:" }), _jsx("div", { mix: [
                                    css({
                                        padding: '0.5rem',
                                        background: '#f8f9fa',
                                        borderRadius: '4px',
                                        color: '#666',
                                    }),
                                ], children: limit ? (_jsxs(_Fragment, { children: ["Stream will close after ", _jsx("strong", { children: limit }), " message", limit === 1 ? '' : 's', "."] })) : (_jsxs(_Fragment, { children: ["No limit set.", ' ', _jsxs("a", { href: "?limit=10", mix: [css({ color: '#007bff', textDecoration: 'underline' })], children: ["Add", ' ', _jsx("code", { mix: [
                                                        css({
                                                            background: '#f5f5f5',
                                                            padding: '0.2rem 0.4rem',
                                                            borderRadius: '3px',
                                                            fontFamily: "'Courier New', monospace",
                                                            fontSize: '0.9em',
                                                        }),
                                                    ], children: "?limit=10" }), ' ', "to the URL"] }), ' ', "to limit messages."] })) })] }), _jsx(MessageStream, { setup: { limit } })] }));
        },
        messages(context) {
            let limitParam = context.url.searchParams.get('limit');
            let limit = limitParam ? parseInt(limitParam, 10) : null;
            if (!limit || !isFinite(limit))
                limit = null;
            let stream = new ReadableStream({
                start(controller) {
                    let messageCount = 0;
                    let interval = setInterval(() => {
                        try {
                            messageCount++;
                            let timestamp = new Date().toLocaleTimeString();
                            let text = `Message #${messageCount} at ${timestamp}`;
                            // Send SSE formatted message
                            controller.enqueue(new TextEncoder().encode(`event: message\n`));
                            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ count: messageCount, message: text })}\n\n`));
                            if (limit && messageCount >= limit) {
                                clearInterval(interval);
                                controller.close();
                            }
                        }
                        catch (error) {
                            console.error('Error enqueuing message:', error);
                            clearInterval(interval);
                        }
                    }, 1000);
                    context.request.signal.addEventListener('abort', () => {
                        clearInterval(interval);
                        try {
                            controller.close();
                        }
                        catch (error) {
                            // Stream may already be closed
                        }
                    });
                },
            });
            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                },
            });
        },
    },
});
