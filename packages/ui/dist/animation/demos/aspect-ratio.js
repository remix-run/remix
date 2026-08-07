import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import {} from '@remix-run/ui';
import { css, on } from '@remix-run/ui';
import { spring } from '@remix-run/ui/animation';
export function AspectRatio(handle) {
    let aspectRatio = 1;
    let width = 100;
    return () => (_jsxs("div", { mix: [
            css({
                display: 'flex',
                alignItems: 'center',
                flexDirection: 'column',
                gap: 20,
            }),
        ], children: [_jsx("div", { mix: [
                    css({
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: 180,
                        height: 180,
                    }),
                ], children: _jsx("div", { mix: [
                        css({
                            backgroundColor: '#8df0cc',
                            borderRadius: 10,
                            transition: spring.transition(['width', 'aspect-ratio'], 'bouncy'),
                        }),
                    ], style: {
                        width,
                        aspectRatio,
                    } }) }), _jsxs("div", { mix: [css({ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' })], children: [_jsxs("label", { mix: [
                            css({
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                fontSize: 13,
                                color: '#666',
                            }),
                        ], children: [_jsx("span", { mix: [css({ width: 50, flexShrink: 0 })], children: "Ratio" }), _jsx("input", { type: "range", value: aspectRatio, min: 0.2, max: 3, step: 0.1, mix: [
                                    css(rangeInputCss),
                                    on('input', (event) => {
                                        let value = event.currentTarget.value;
                                        aspectRatio = parseFloat(value);
                                        handle.update();
                                    }),
                                ] }), _jsx("span", { mix: [css({ width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' })], children: aspectRatio.toFixed(1) })] }), _jsxs("label", { mix: [
                            css({
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                fontSize: 13,
                                color: '#666',
                            }),
                        ], children: [_jsx("span", { mix: [css({ width: 50, flexShrink: 0 })], children: "Width" }), _jsx("input", { type: "range", value: width, min: 20, max: 160, step: 5, mix: [
                                    css(rangeInputCss),
                                    on('input', (event) => {
                                        let value = event.currentTarget.value;
                                        width = parseFloat(value);
                                        handle.update();
                                    }),
                                ] }), _jsx("span", { mix: [css({ width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' })], children: width })] })] })] }));
}
const rangeInputCss = {
    flex: 1,
    accentColor: '#8df0cc',
    cursor: 'pointer',
};
//# sourceMappingURL=aspect-ratio.js.map