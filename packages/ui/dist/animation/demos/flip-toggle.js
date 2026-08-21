import { jsx as _jsx } from "@remix-run/ui/jsx-runtime";
import { css, on } from '@remix-run/ui';
import { animateLayout } from '@remix-run/ui/animation';
export function FlipToggle(handle) {
    let isOn = false;
    return () => (_jsx("button", { mix: [
            css({
                width: 90,
                height: 50,
                backgroundColor: 'rgba(153, 17, 255, 0.2)',
                borderRadius: 50,
                cursor: 'pointer',
                display: 'flex',
                padding: 10,
                border: 'none',
            }),
            on('click', () => {
                isOn = !isOn;
                handle.update();
            }),
        ], style: {
            // The actual layout property that changes
            justifyContent: isOn ? 'flex-start' : 'flex-end',
        }, children: _jsx("div", { mix: [
                css({
                    width: 30,
                    height: 30,
                    backgroundColor: '#9911ff',
                    borderRadius: '50%',
                }),
                animateLayout({
                    duration: 200,
                    easing: 'ease-in-out',
                }),
            ] }) }));
}
//# sourceMappingURL=flip-toggle.js.map