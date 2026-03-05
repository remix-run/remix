import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { clientEntry, Frame, css, on, ref } from 'remix/component';
import { routes } from '../routes.js';
let moduleUrl = '/assets/state-search-page.js#StateSearchPage';
export let StateSearchPage = clientEntry(moduleUrl, (handle, setup) => {
    let query = setup || '';
    let input;
    return () => (_jsxs("section", { children: [_jsxs("form", { mix: [
                    on('submit', async (event) => {
                        event.preventDefault();
                        query = input.value.trim();
                        await handle.update();
                        input.select();
                    }),
                    css({ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }),
                ], children: [_jsxs("label", { mix: [css({ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 320px' })], children: [_jsx("span", { mix: [css({ fontSize: 13, color: '#b9c6ff' })], children: "Search states" }), _jsx("input", { placeholder: "Try: carolina, dakota, new", mix: [
                                    ref((node) => (input = node)),
                                    css({
                                        minWidth: 260,
                                        padding: '8px 10px',
                                        borderRadius: 10,
                                        border: '1px solid rgba(255,255,255,0.18)',
                                        background: 'rgba(255,255,255,0.04)',
                                        color: '#e9eefc',
                                    }),
                                ] })] }), _jsx("button", { type: "submit", mix: [
                            css({
                                padding: '8px 12px',
                                borderRadius: 10,
                                border: '1px solid rgba(255,255,255,0.18)',
                                background: 'rgba(255,255,255,0.06)',
                                color: '#e9eefc',
                                cursor: 'pointer',
                                marginTop: 20,
                                '&:hover': { background: 'rgba(255,255,255,0.1)' },
                            }),
                        ], children: "Search" })] }), query.trim() ? (_jsx("div", { mix: [
                    css({
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 12,
                        padding: 12,
                        background: 'rgba(255,255,255,0.03)',
                    }),
                ], children: _jsx(Frame, { src: routes.frames.stateSearchResults.href(undefined, { query }), fallback: _jsx("div", { mix: [css({ color: '#9aa8e8' })], children: "Searching states\u2026" }) }) })) : (_jsx("p", { mix: [css({ margin: 0, color: '#9aa8e8' })], children: "Enter a state name to run the frame search." }))] }));
});
