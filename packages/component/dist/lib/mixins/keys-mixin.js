import { jsx as _jsx } from "@remix-run/component/jsx-runtime";
// @jsxRuntime classic
// @jsx jsx
import { on } from "./on-mixin.js";
import { createMixin } from "../mixin.js";
import { jsx } from "../jsx.js";
export let escapeEventType = 'keydown:Escape';
export let enterEventType = 'keydown:Enter';
export let spaceEventType = 'keydown: ';
export let backspaceEventType = 'keydown:Backspace';
export let deleteEventType = 'keydown:Delete';
export let arrowLeftEventType = 'keydown:ArrowLeft';
export let arrowRightEventType = 'keydown:ArrowRight';
export let arrowUpEventType = 'keydown:ArrowUp';
export let arrowDownEventType = 'keydown:ArrowDown';
export let homeEventType = 'keydown:Home';
export let endEventType = 'keydown:End';
export let pageUpEventType = 'keydown:PageUp';
export let pageDownEventType = 'keydown:PageDown';
let keyToEventType = {
    Escape: escapeEventType,
    Enter: enterEventType,
    ' ': spaceEventType,
    Backspace: backspaceEventType,
    Delete: deleteEventType,
    ArrowLeft: arrowLeftEventType,
    ArrowRight: arrowRightEventType,
    ArrowUp: arrowUpEventType,
    ArrowDown: arrowDownEventType,
    Home: homeEventType,
    End: endEventType,
    PageUp: pageUpEventType,
    PageDown: pageDownEventType,
};
let baseKeysEvents = createMixin((handle) => (props) => (_jsx(handle.element, { ...props, mix: [
        on('keydown', (event) => {
            let type = keyToEventType[event.key];
            if (!type)
                return;
            event.preventDefault();
            event.currentTarget.dispatchEvent(new KeyboardEvent(type, {
                key: event.key,
            }));
        }),
    ] })));
/**
 * Normalizes common keyboard keys into custom key-specific DOM events.
 */
export let keysEvents = Object.assign(baseKeysEvents, {
    escape: escapeEventType,
    enter: enterEventType,
    space: spaceEventType,
    backspace: backspaceEventType,
    del: deleteEventType,
    arrowLeft: arrowLeftEventType,
    arrowRight: arrowRightEventType,
    arrowUp: arrowUpEventType,
    arrowDown: arrowDownEventType,
    home: homeEventType,
    end: endEventType,
    pageUp: pageUpEventType,
    pageDown: pageDownEventType,
});
//# sourceMappingURL=keys-mixin.js.map