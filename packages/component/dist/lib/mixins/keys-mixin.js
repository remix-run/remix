import { renderMixinElement } from "../mixin.js";
import { on } from "./on-mixin.js";
import { createMixin } from "../mixin.js";
export const escapeEventType = 'keydown:Escape';
export const enterEventType = 'keydown:Enter';
export const spaceEventType = 'keydown: ';
export const backspaceEventType = 'keydown:Backspace';
export const deleteEventType = 'keydown:Delete';
export const arrowLeftEventType = 'keydown:ArrowLeft';
export const arrowRightEventType = 'keydown:ArrowRight';
export const arrowUpEventType = 'keydown:ArrowUp';
export const arrowDownEventType = 'keydown:ArrowDown';
export const homeEventType = 'keydown:Home';
export const endEventType = 'keydown:End';
export const pageUpEventType = 'keydown:PageUp';
export const pageDownEventType = 'keydown:PageDown';
const keyToEventType = {
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
const baseKeysEvents = createMixin((handle) => (props) => renderMixinElement(handle.element, {
    ...(props ?? {}),
    mix: [
        on('keydown', (event) => {
            let type = keyToEventType[event.key];
            if (!type)
                return;
            event.preventDefault();
            event.currentTarget.dispatchEvent(new KeyboardEvent(type, {
                key: event.key,
            }));
        }),
    ],
}));
/**
 * Normalizes common keyboard keys into custom key-specific DOM events.
 */
export const keysEvents = Object.assign(baseKeysEvents, {
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