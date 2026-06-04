import { jsx as _jsx } from "@remix-run/ui/jsx-runtime";
import { css } from '@remix-run/ui';
import { animateLayout, spring } from '@remix-run/ui/animation';
const initialOrder = ['#ff0088', '#dd00ee', '#9911ff', '#0d63f8'];
function shuffle(array) {
    let result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
export function Reordering(handle) {
    let order = initialOrder;
    function scheduleNextShuffle() {
        setTimeout(() => {
            if (handle.signal.aborted)
                return;
            order = shuffle(order);
            handle.update();
            scheduleNextShuffle();
        }, 1000);
    }
    scheduleNextShuffle();
    return () => (_jsx("ul", { mix: [
            css({
                listStyle: 'none',
                padding: 0,
                margin: 0,
                position: 'relative',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                width: 220,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
            }),
        ], children: order.map((backgroundColor) => (_jsx("li", { mix: [
                css({
                    width: 100,
                    height: 100,
                    borderRadius: 10,
                }),
                animateLayout({
                    ...spring({ duration: 600, bounce: 0.2 }),
                }),
            ], style: { backgroundColor } }, backgroundColor))) }));
}
//# sourceMappingURL=reordering.js.map