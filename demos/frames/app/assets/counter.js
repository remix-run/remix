import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { clientEntry, css, on } from 'remix/component';
export let Counter = clientEntry('/assets/counter.js#Counter', function Counter(handle, setup) {
    let count = setup;
    return (props) => (_jsxs("div", { mix: [css({ display: 'flex', gap: 12, alignItems: 'center' })], children: [_jsx("strong", { mix: [css({ width: 72 })], children: props.label }), _jsx("button", { type: "button", mix: [
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
                        count--;
                        handle.update();
                    }),
                ], children: "\u2212" }), _jsx("span", { mix: [css({ minWidth: 48, textAlign: 'center', fontVariantNumeric: 'tabular-nums' })], children: count }), _jsx("button", { type: "button", mix: [
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
                        count++;
                        handle.update();
                    }),
                ], children: "+" })] }));
});
