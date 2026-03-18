import { jsx as _jsx } from "@remix-run/component/jsx-runtime";
import { createMixin, on } from '@remix-run/component';
import { anchor } from "./anchor.js";
import { ui } from "./theme.js";
export let popover = createMixin((handle) => {
    let cleanupAnchor = () => { };
    let currentId = '';
    let currentOptions = {};
    function anchorToOwner(node) {
        let owner = document.querySelector(`[popovertarget="${currentId}"]`);
        if (!(owner instanceof HTMLElement)) {
            console.warn(`No popover owner found for #${currentId}`);
            return;
        }
        cleanupAnchor();
        cleanupAnchor = anchor(node, owner, currentOptions);
    }
    handle.addEventListener('remove', cleanupAnchor);
    return (...args) => {
        let options = args.length === 2 ? args[0] : undefined;
        let props = args.length === 2 ? args[1] : args[0];
        currentOptions = options ?? {};
        props.id ??= handle.id;
        currentId = props.id;
        props.popover ??= 'manual';
        return (_jsx(handle.element, { ...props, mix: [
                ui.popover.surface,
                on('beforetoggle', (event) => {
                    if (event.newState === 'open') {
                        anchorToOwner(event.currentTarget);
                    }
                }),
                on('toggle', (event) => {
                    if (event.newState === 'closed') {
                        cleanupAnchor();
                        cleanupAnchor = () => { };
                    }
                }),
            ] }));
    };
});
//# sourceMappingURL=popover.js.map