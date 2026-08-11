import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css } from '@remix-run/ui';
/*
 * A comparison of color interpolation methods.
 *
 * The "dimming effect" in browser animations happens because sRGB is
 * gamma-encoded, so linear interpolation passes through desaturated colors.
 *
 * The OKLCH box uses the @property hack: register a custom property as <number>,
 * animate it 0→1, then use color-mix(in oklch, ...) with that number.
 */
export function ColorInterpolation() {
    return () => (_jsxs("div", { mix: [css({ display: 'flex', gap: 30, alignItems: 'center', justifyContent: 'center' })], children: [_jsx("style", { children: `
          @property --color-t {
            syntax: '<number>';
            inherits: false;
            initial-value: 0;
          }

          @keyframes color-t-anim {
            0%, 100% { --color-t: 0; }
            50% { --color-t: 1; }
          }

          .oklch-box {
            animation: color-t-anim 4s linear infinite;
            background-color: color-mix(
              in oklch,
              #ff0088 calc((1 - var(--color-t)) * 100%),
              #0d63f8 calc(var(--color-t) * 100%)
            );
          }
        ` }), _jsxs("div", { mix: [css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 })], children: [_jsx("div", { mix: [
                            css({
                                width: 100,
                                height: 100,
                                borderRadius: 8,
                                backgroundColor: '#ff0088',
                                '@keyframes srgb-color': {
                                    '0%, 100%': { backgroundColor: '#ff0088' },
                                    '50%': { backgroundColor: '#0d63f8' },
                                },
                                animation: 'srgb-color 4s linear infinite',
                            }),
                        ] }), _jsx("div", { mix: [css({ fontSize: 14, color: '#666' })], children: "sRGB" })] }), _jsxs("div", { mix: [css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 })], children: [_jsx("div", { className: "oklch-box", mix: [
                            css({
                                width: 100,
                                height: 100,
                                borderRadius: 8,
                            }),
                        ] }), _jsx("div", { mix: [css({ fontSize: 14, color: '#666' })], children: "OKLCH" })] })] }));
}
//# sourceMappingURL=color-interpolation.js.map