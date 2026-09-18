import { jsx as _jsx } from "@remix-run/ui/jsx-runtime";
import { css } from '@remix-run/ui';
import { animateEntrance } from '@remix-run/ui/animation';
export function TransitionOptions() {
    return () => (_jsx("div", { mix: [
            css({
                width: 100,
                height: 100,
                borderRadius: '50%',
                backgroundColor: '#9911ff',
            }),
            animateEntrance({
                opacity: 0,
                transform: 'scale(0.5)',
                duration: 800,
                delay: 500,
                easing: 'cubic-bezier(0, 0.71, 0.2, 1.01)',
            }),
        ] }));
}
//# sourceMappingURL=transition-options.js.map