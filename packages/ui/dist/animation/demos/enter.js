import { jsx as _jsx } from "@remix-run/ui/jsx-runtime";
import { css } from '@remix-run/ui';
import { animateEntrance, spring } from '@remix-run/ui/animation';
export function EnterAnimation() {
    return () => (_jsx("div", { mix: [
            css({
                width: 100,
                height: 100,
                backgroundColor: '#dd00ee',
                borderRadius: '50%',
            }),
            animateEntrance({
                opacity: 0,
                transform: 'scale(0)',
                ...spring({ duration: 400, bounce: 0.5 }),
            }),
        ] }));
}
//# sourceMappingURL=enter.js.map