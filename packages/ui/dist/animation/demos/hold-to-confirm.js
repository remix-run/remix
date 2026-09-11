import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { createMixin, css, on } from '@remix-run/ui';
import { animateEntrance, animateExit, spring } from '@remix-run/ui/animation';
// Demo
const buttonExitAnimation = {
    opacity: 0,
    transform: 'scale(1.15)',
    duration: 100,
    easing: 'ease-in',
};
const confirmationEnterAnimation = {
    opacity: 0,
    transform: 'scale(0.9)',
    duration: 200,
    easing: 'ease-out',
};
export function HoldToConfirm(handle) {
    let confirmed = false;
    return () => (_jsxs("div", { mix: [
            css({
                display: 'grid',
                placeItems: 'center',
                minHeight: 140,
                // so children can animate in the same position
                '& > *': { gridArea: '1 / 1' },
            }),
        ], children: [!confirmed && (_jsx(HoldButton, { onConfirm: () => {
                    confirmed = true;
                    handle.update();
                } }, "hold-button")), confirmed && (_jsx(Confirmation, { onReset: () => {
                    confirmed = false;
                    handle.update();
                } }, "confirmed"))] }));
}
function HoldButton(handle) {
    let confirming = false;
    return () => (_jsxs("button", { mix: [
            animateExit(buttonExitAnimation),
            css({
                position: 'relative',
                overflow: 'hidden',
                width: 200,
                height: 56,
                border: 'none',
                borderRadius: 12,
                backgroundColor: '#dc2626',
                color: 'white',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'transform 150ms ease',
                '&:focus': {
                    outline: '3px solid rgba(220, 38, 38, 0.4)',
                    outlineOffset: 2,
                },
                '&:active': {
                    transform: 'scale(0.98)',
                },
            }),
            confirmPress(),
            on(confirmPress.start, () => {
                confirming = true;
                handle.update();
            }),
            on(confirmPress.cancel, () => {
                if (!confirming)
                    return;
                confirming = false;
                handle.update();
            }),
            on(confirmPress.end, () => {
                handle.props.onConfirm();
            }),
        ], children: [_jsx("div", { mix: [
                    css({
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        transformOrigin: 'left',
                    }),
                ], style: {
                    transform: confirming ? 'scaleX(1)' : 'scaleX(0)',
                    transition: confirming
                        ? `transform ${PRESS_CONFIRM_TIME}ms linear`
                        : `transform ${spring({ duration: 100, bounce: 0 })}`,
                } }), _jsxs("span", { mix: [
                    css({
                        position: 'relative',
                        zIndex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                    }),
                ], children: [_jsx(TrashIcon, {}), "Hold to Delete"] })] }));
}
function Confirmation(handle) {
    return () => (_jsxs("div", { mix: [
            animateEntrance(confirmationEnterAnimation),
            css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
            }),
        ], children: [_jsxs("div", { mix: [
                    css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        color: '#22c55e',
                        fontSize: 18,
                        fontWeight: 600,
                    }),
                ], children: [_jsx(CheckIcon, {}), "Deleted"] }), _jsx("button", { mix: [
                    css({
                        padding: '8px 16px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        backgroundColor: 'white',
                        color: '#64748b',
                        fontSize: 14,
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                        '&:hover': {
                            backgroundColor: '#f8fafc',
                            borderColor: '#cbd5e1',
                        },
                    }),
                    on('click', () => handle.props.onReset()),
                ], children: "Reset Demo" })] }));
}
function TrashIcon() {
    return () => (_jsxs("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("polyline", { points: "3 6 5 6 21 6" }), _jsx("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })] }));
}
function CheckIcon() {
    return () => (_jsx("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("polyline", { points: "20 6 9 17 4 12" }) }));
}
const PRESS_CONFIRM_TIME = 2000;
const pressConfirmStartEventType = 'demo:press-confirm-start';
const pressConfirmCancelEventType = 'demo:press-confirm-cancel';
const pressConfirmEndEventType = 'demo:press-confirm-end';
const baseConfirmPress = createMixin((handle) => {
    let timer = 0;
    let pressing = false;
    let clearTimer = () => {
        if (timer) {
            clearTimeout(timer);
            timer = 0;
        }
    };
    let start = (target) => {
        clearTimer();
        pressing = true;
        target.dispatchEvent(new Event(pressConfirmStartEventType, { bubbles: true }));
        timer = window.setTimeout(() => {
            timer = 0;
            pressing = false;
            target.dispatchEvent(new Event(pressConfirmEndEventType, { bubbles: true }));
        }, PRESS_CONFIRM_TIME);
    };
    let cancel = (target) => {
        if (!pressing)
            return;
        clearTimer();
        pressing = false;
        target.dispatchEvent(new Event(pressConfirmCancelEventType, { bubbles: true }));
    };
    handle.addEventListener('remove', () => {
        clearTimer();
        pressing = false;
    });
    return (props) => (_jsx(handle.element, { ...props, mix: [
            on('pointerdown', (event) => {
                if (event.isPrimary === false)
                    return;
                start(event.currentTarget);
            }),
            on('pointerup', (event) => {
                cancel(event.currentTarget);
            }),
            on('pointercancel', (event) => {
                cancel(event.currentTarget);
            }),
            on('pointerleave', (event) => {
                cancel(event.currentTarget);
            }),
            on('keydown', (event) => {
                if (!(event.key === 'Enter' || event.key === ' ') || event.repeat)
                    return;
                event.preventDefault();
                start(event.currentTarget);
            }),
            on('keyup', (event) => {
                if (!(event.key === 'Enter' || event.key === ' '))
                    return;
                event.preventDefault();
                cancel(event.currentTarget);
            }),
            on('blur', (event) => {
                cancel(event.currentTarget);
            }),
        ] }));
});
const confirmPress = Object.assign(baseConfirmPress, {
    start: pressConfirmStartEventType,
    cancel: pressConfirmCancelEventType,
    end: pressConfirmEndEventType,
});
//# sourceMappingURL=hold-to-confirm.js.map