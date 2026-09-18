import { jsx as _jsx } from "@remix-run/ui/jsx-runtime";
import { css } from '@remix-run/ui';
export function Rotate() {
    return () => (_jsx("div", { mix: [
            css({
                width: 100,
                height: 100,
                backgroundColor: '#ff0088',
                borderRadius: 5,
                '@keyframes rotate-demo': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                },
                animation: `rotate-demo 1s ease-in-out 1`,
            }),
        ] }));
}
//# sourceMappingURL=rotate.js.map