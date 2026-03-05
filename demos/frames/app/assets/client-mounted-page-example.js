import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { clientEntry, Frame, css, on } from 'remix/component';
import { routes } from '../routes.js';
export let ClientMountedPageExample = clientEntry('/assets/client-mounted-page-example.js#ClientMountedPageExample', (handle) => {
    let showFrame = false;
    return () => (_jsxs("section", { mix: [
            css({
                marginTop: 16,
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                padding: 12,
                background: 'rgba(255,255,255,0.03)',
            }),
        ], children: [_jsxs("div", { mix: [
                    css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                    }),
                ], children: [_jsxs("div", { children: [_jsx("div", { mix: [css({ fontSize: 13, color: '#b9c6ff' })], children: "Client-mounted frame test" }), _jsx("div", { mix: [css({ fontSize: 12, color: '#9aa8e8' })], children: "Mount a frame whose server content includes a nested non-blocking frame." })] }), _jsx("button", { type: "button", mix: [
                            css({
                                padding: '6px 10px',
                                borderRadius: 10,
                                border: '1px solid rgba(255,255,255,0.18)',
                                background: 'rgba(255,255,255,0.06)',
                                color: '#e9eefc',
                                cursor: 'pointer',
                                '&:hover': { background: 'rgba(255,255,255,0.10)' },
                            }),
                            on('click', () => {
                                showFrame = !showFrame;
                                handle.update();
                            }),
                        ], children: showFrame ? 'Remove Frame' : 'Mount Frame' })] }), showFrame ? (_jsx("div", { mix: [css({ marginTop: 10 })], children: _jsx(Frame, { src: routes.frames.clientMountedOuter.href(), fallback: _jsx("div", { mix: [css({ color: '#9aa8e8' })], children: "Loading outer mounted frame\u2026" }) }) })) : null] }));
});
