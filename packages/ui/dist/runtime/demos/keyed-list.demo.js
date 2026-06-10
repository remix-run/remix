import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { on } from '@remix-run/ui';
/**
 * @name Keyed List
 * @description Exercises keyed DOM reconciliation with shuffling, reversing, and per-item controls.
 */
export default function App(handle) {
    let items = [
        { id: 'a', label: 'Item A' },
        { id: 'b', label: 'Item B' },
        { id: 'c', label: 'Item C' },
        { id: 'd', label: 'Item D' },
    ];
    let shuffleInterval = null;
    let moveUp = (index) => {
        if (index === 0)
            return;
        let newItems = [...items];
        [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
        items = newItems;
        handle.update();
    };
    let moveDown = (index) => {
        if (index === items.length - 1)
            return;
        let newItems = [...items];
        [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
        items = newItems;
        handle.update();
    };
    let reverse = () => {
        items = [...items].reverse();
        handle.update();
    };
    let shuffle = () => {
        let newItems = [...items];
        for (let i = newItems.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [newItems[i], newItems[j]] = [newItems[j], newItems[i]];
        }
        items = newItems;
        handle.update();
    };
    let toggleAutoShuffle = () => {
        if (shuffleInterval !== null) {
            clearInterval(shuffleInterval);
            shuffleInterval = null;
        }
        else {
            shuffleInterval = setInterval(() => {
                shuffle();
            }, 1000);
        }
        handle.update();
    };
    return () => (_jsxs("div", { children: [_jsxs("div", { className: "controls", children: [_jsx("button", { mix: [on('click', reverse)], children: "Reverse List" }), _jsx("button", { mix: [on('click', shuffle)], children: "Shuffle List" }), _jsx("button", { mix: [on('click', toggleAutoShuffle)], children: shuffleInterval !== null ? 'Stop Auto-Shuffle' : 'Start Auto-Shuffle' })] }), items.map((item, index) => (_jsxs("div", { className: "list-item", children: [_jsx("input", { type: "text", placeholder: item.label, defaultValue: item.label }), _jsx("button", { 
                        // disabled={index === 0}
                        mix: [on('click', () => moveUp(index))], children: "\u2191" }), _jsx("button", { 
                        // disabled={index === items.length - 1}
                        mix: [on('click', () => moveDown(index))], children: "\u2193" })] }, item.id)))] }));
}
//# sourceMappingURL=keyed-list.demo.js.map