import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "remix/component/jsx-runtime";
import { addEventListeners, clientEntry, css } from 'remix/component';
import { routes } from '../routes.js';
export const MessageStream = clientEntry(routes.assets.href({ path: 'message-stream.js#MessageStream' }), function MessageStream(handle, setup) {
    let { limit } = setup;
    let messages = [];
    let connected = false;
    handle.queueTask(() => {
        let eventSource = new EventSource(routes.messages.href(null, limit ? { limit } : {}));
        addEventListeners(eventSource, handle.signal, {
            open: () => {
                connected = true;
                handle.update();
            },
            message: (event) => {
                let data = JSON.parse(event.data);
                messages.push(data);
                handle.update();
            },
            error: () => {
                connected = false;
                handle.update();
                eventSource.close();
            },
        });
        handle.signal.addEventListener('abort', () => {
            eventSource.close();
        });
    });
    return () => (_jsxs(_Fragment, { children: [_jsx("div", { mix: [
                    css({
                        background: 'white',
                        padding: '1.5rem',
                        borderRadius: '8px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        marginBottom: '1.5rem',
                    }),
                ], children: _jsxs("div", { mix: [
                        css({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1rem',
                            background: connected ? '#e3f2fd' : '#ffebee',
                            borderLeft: connected ? '4px solid #2196f3' : '4px solid #f44336',
                            borderRadius: '4px',
                            color: connected ? '#1976d2' : '#c62828',
                            fontWeight: 500,
                        }),
                    ], children: [_jsx("span", { mix: [
                                css({
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: connected ? '#2196f3' : '#f44336',
                                    animation: connected ? 'pulse 2s ease-in-out infinite' : 'none',
                                }),
                            ] }), _jsx("span", { children: connected ? 'Connected' : 'Disconnected' })] }) }), _jsxs("div", { mix: [
                    css({
                        background: 'white',
                        padding: '1.5rem',
                        borderRadius: '8px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        minHeight: '200px',
                    }),
                ], children: [_jsx("h2", { mix: [css({ color: '#333', marginBottom: '1rem', fontSize: '1.25rem' })], children: "Messages" }), _jsx("ul", { mix: [css({ listStyle: 'none' })], children: messages.length === 0 ? (_jsx("li", { mix: [css({ textAlign: 'center', color: '#999', padding: '3rem 1rem' })], children: "Waiting for messages..." })) : (messages.map((message) => (_jsxs("li", { mix: [
                                css({
                                    padding: '0.75rem 1rem',
                                    background: '#f8f9fa',
                                    borderLeft: '3px solid #4caf50',
                                    borderRadius: '4px',
                                    marginBottom: '0.5rem',
                                    animation: 'slideIn 0.3s ease-out',
                                }),
                            ], children: [_jsxs("span", { mix: [css({ fontWeight: 600, color: '#4caf50' })], children: ["#", message.count] }), ' ', _jsx("span", { mix: [css({ color: '#666' })], children: message.message })] }, message.count)))) })] })] }));
});
