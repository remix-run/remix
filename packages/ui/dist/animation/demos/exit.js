import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css, on } from '@remix-run/ui';
import { animateEntrance, animateExit, spring } from '@remix-run/ui/animation';
export function ExitAnimation(handle) {
    let isVisible = true;
    let shouldAnimate = false;
    handle.queueTask(() => {
        shouldAnimate = true;
    });
    return () => (_jsxs("div", { mix: [
            css({
                display: 'flex',
                flexDirection: 'column',
                width: '100px',
                height: '160px',
                position: 'relative',
            }),
        ], children: [isVisible && (_jsx("div", { mix: [
                    css({
                        width: '100px',
                        height: '100px',
                        backgroundColor: '#0cdcf7',
                        borderRadius: '10px',
                    }),
                    animateEntrance(shouldAnimate && {
                        opacity: 0,
                        transform: 'scale(0)',
                        ...spring('snappy'),
                    }),
                    animateExit({
                        opacity: 0,
                        transform: 'scale(0)',
                        ...spring(),
                    }),
                ] }, "exit-animation")), _jsx("button", { mix: [
                    css({
                        backgroundColor: '#0cdcf7',
                        borderRadius: '10px',
                        padding: '10px 20px',
                        color: '#0f1115',
                        border: 'none',
                        cursor: 'pointer',
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        transition: `transform 100ms ease-in-out`,
                        '&:active': {
                            transform: 'translateY(1px)',
                        },
                    }),
                    on('click', () => {
                        isVisible = !isVisible;
                        handle.update();
                    }),
                ], children: isVisible ? 'Hide' : 'Show' })] }));
}
//# sourceMappingURL=exit.js.map