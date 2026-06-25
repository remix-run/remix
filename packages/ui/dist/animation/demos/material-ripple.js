import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css, on, ref } from '@remix-run/ui';
import { animateEntrance, animateExit } from '@remix-run/ui/animation';
export function MaterialRipple(handle) {
    let ripples = [];
    let idCounter = 0;
    let buttonEl = null;
    function createRipple(originX, originY) {
        if (!buttonEl)
            return;
        let rect = buttonEl.getBoundingClientRect();
        let localX = originX - rect.left;
        let localY = originY - rect.top;
        let dx = Math.max(localX, rect.width - localX);
        let dy = Math.max(localY, rect.height - localY);
        let radius = Math.sqrt(dx * dx + dy * dy);
        let size = radius * 2;
        let id = ++idCounter;
        ripples = [...ripples, { id, x: localX, y: localY, size }];
        handle.update();
    }
    function removeAllRipples() {
        if (ripples.length > 0) {
            ripples = [];
            handle.update();
        }
    }
    function createCenteredRipple() {
        if (!buttonEl)
            return;
        let rect = buttonEl.getBoundingClientRect();
        createRipple(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    return () => (_jsxs("button", { mix: [
            ref((el) => {
                buttonEl = el;
            }),
            css({
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 20px',
                borderRadius: 4,
                textTransform: 'uppercase',
                backgroundColor: 'transparent',
                color: '#7c3aed',
                border: '1px solid #7c3aed',
                userSelect: 'none',
                cursor: 'pointer',
                overflow: 'hidden',
                letterSpacing: '0.2px',
                WebkitTapHighlightColor: 'transparent',
                transition: 'border-color 200ms linear, background-color 200ms linear',
                '&:hover': {
                    borderColor: '#6d28d9',
                    backgroundColor: '#7c3aed20',
                },
                '&:focus-visible': {
                    outline: '2px solid #7c3aed80',
                    outlineOffset: 2,
                },
            }),
            on('pointerdown', (event) => {
                if (event.isPrimary === false)
                    return;
                createRipple(event.clientX, event.clientY);
            }),
            on('pointerup', removeAllRipples),
            on('pointercancel', removeAllRipples),
            on('pointerleave', removeAllRipples),
            on('keydown', (event) => {
                if (!(event.key === 'Enter' || event.key === ' ') || event.repeat)
                    return;
                event.preventDefault();
                createCenteredRipple();
            }),
            on('keyup', (event) => {
                if (!(event.key === 'Enter' || event.key === ' '))
                    return;
                event.preventDefault();
                removeAllRipples();
            }),
            on('blur', removeAllRipples),
        ], children: ["Click me", _jsx("span", { "aria-hidden": "true", mix: [
                    css({
                        position: 'absolute',
                        inset: 0,
                        overflow: 'hidden',
                        borderRadius: 'inherit',
                        pointerEvents: 'none',
                    }),
                ], children: ripples.map((ripple) => (
                // Outer span: handles exit (fade out)
                _jsx("span", { mix: [
                        css({
                            position: 'absolute',
                            borderRadius: '50%',
                        }),
                        animateExit({
                            opacity: 0,
                            duration: 550,
                            easing: 'ease-out',
                        }),
                    ], style: {
                        width: ripple.size,
                        height: ripple.size,
                        left: ripple.x - ripple.size / 2,
                        top: ripple.y - ripple.size / 2,
                    }, children: _jsx("span", { mix: [
                            css({
                                display: 'block',
                                width: '100%',
                                height: '100%',
                                borderRadius: 'inherit',
                                backgroundColor: 'currentColor',
                                opacity: 0.4,
                            }),
                            animateEntrance({
                                opacity: 0,
                                transform: 'scale(0)',
                                duration: 300,
                                easing: 'ease-out',
                            }),
                        ] }) }, ripple.id))) })] }));
}
//# sourceMappingURL=material-ripple.js.map