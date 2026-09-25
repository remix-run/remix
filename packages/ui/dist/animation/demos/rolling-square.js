import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import {} from '@remix-run/ui';
import { css, on } from '@remix-run/ui';
import { spring } from '@remix-run/ui/animation';
export function RollingSquare(handle) {
    let toggled = false;
    return () => (_jsxs("div", { mix: [
            css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px',
                minWidth: '300px',
            }),
        ], children: [_jsx("div", { mix: [
                    css({
                        width: '80px',
                        height: '80px',
                        backgroundColor: '#8df0cc',
                        borderRadius: '10px',
                        transition: `transform ${spring({ duration: 500, bounce: 0.5 })}`,
                    }),
                ], style: {
                    transform: toggled ? 'translateX(100%) rotate(180deg)' : 'translateX(-100%)',
                } }), _jsx("button", { mix: [
                    css({
                        backgroundColor: '#8df0cc',
                        color: '#0f1115',
                        borderRadius: '5px',
                        padding: '10px',
                        margin: '10px',
                        border: 'none',
                        cursor: 'pointer',
                    }),
                    on('click', () => {
                        toggled = !toggled;
                        handle.update();
                    }),
                ], children: "Toggle position" })] }));
}
//# sourceMappingURL=rolling-square.js.map