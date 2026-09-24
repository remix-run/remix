import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css, on } from '@remix-run/ui';
import { animateEntrance, animateExit } from '@remix-run/ui/animation';
const ease = 'cubic-bezier(0.26, 0.02, 0.23, 0.94)';
function OverlapExample(handle) {
    let shouldAnimate = false;
    handle.queueTask(() => {
        shouldAnimate = true;
    });
    return () => {
        let { state } = handle.props;
        let animationMix = [
            animateExit({
                opacity: 0,
                transform: 'scale(0.8)',
                duration: 300,
                easing: ease,
            }),
        ];
        if (shouldAnimate) {
            animationMix.unshift(animateEntrance({
                opacity: 0,
                transform: 'scale(0.6)',
                duration: 300,
                easing: ease,
            }));
        }
        return (_jsx("div", { 
            // grid layout so children render in the same position
            mix: [css({ display: 'grid', width: 80, height: 80, '& > *': { gridArea: '1 / 1' } })], children: state ? (_jsx("div", { mix: animationMix, children: _jsx(Circle, { filled: true, children: _jsx(FilledIcon, {}) }) }, "filled")) : (_jsx("div", { mix: animationMix, children: _jsx(Circle, { children: _jsx(OutlineIcon, {}) }) }, "outline")) }));
    };
}
function WaitExample(handle) {
    let shouldAnimate = false;
    handle.queueTask(() => {
        shouldAnimate = true;
    });
    return () => {
        let { state } = handle.props;
        let animationMix = [
            animateExit({
                opacity: 0,
                transform: 'scale(0.8)',
                duration: 300,
                easing: ease,
            }),
        ];
        if (shouldAnimate) {
            animationMix.unshift(animateEntrance({
                opacity: 0,
                transform: 'scale(0.6)',
                duration: 300,
                easing: ease,
                delay: 300,
            }));
        }
        return (_jsx("div", { 
            // grid layout so children render in the same position
            mix: [css({ display: 'grid', width: 80, height: 80, '& > *': { gridArea: '1 / 1' } })], children: state ? (_jsx("div", { mix: animationMix, children: _jsx(Circle, { filled: true, children: _jsx(FilledIcon, {}) }) }, "filled")) : (_jsx("div", { mix: animationMix, children: _jsx(Circle, { children: _jsx(OutlineIcon, {}) }) }, "outline")) }));
    };
}
export function SharedLayout(handle) {
    let state = true;
    return () => (_jsxs("div", { mix: [
            css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
            }),
        ], children: [_jsxs("div", { mix: [css({ display: 'flex', gap: 16 })], children: [_jsx(OverlapExample, { state: state }), _jsx(WaitExample, { state: state })] }), _jsx("button", { mix: [
                    css({
                        backgroundColor: '#0f1115',
                        color: '#f5f5f5',
                        border: 'none',
                        borderRadius: 8,
                        padding: '12px 32px',
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'transform 100ms ease-in-out',
                        '&:active': {
                            transform: 'scale(0.95)',
                        },
                    }),
                    on('click', () => {
                        state = !state;
                        handle.update();
                    }),
                ], children: "Switch" })] }));
}
function Circle(handle) {
    return () => (_jsx("div", { mix: [
            css({
                width: 80,
                height: 80,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                backgroundColor: handle.props.filled ? '#0f1115' : 'transparent',
                color: handle.props.filled ? '#f5f5f5' : '#0f1115',
                border: handle.props.filled ? '2px solid #0f1115' : '2px solid #0f1115',
            }),
        ], children: handle.props.children }));
}
function FilledIcon() {
    return () => (_jsxs("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" }), _jsx("path", { d: "m21 3-9 9" }), _jsx("path", { d: "M15 3h6v6" })] }));
}
function OutlineIcon() {
    return () => (_jsxs("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }), _jsx("path", { d: "M9 12h6" })] }));
}
//# sourceMappingURL=shared-layout.js.map