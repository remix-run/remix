import { jsx as _jsx } from "@remix-run/component/jsx-runtime";
// @jsxRuntime classic
// @jsx createElement
import { createElement, createMixin, on } from '@remix-run/component';
export const filterText = createMixin((handle) => {
    let text = '';
    let timeoutId = 0;
    function clearFilter() {
        clearTimeout(timeoutId);
        timeoutId = 0;
        text = '';
    }
    function updateFilter(nextText, onText) {
        text = nextText;
        onText(text);
    }
    handle.addEventListener('remove', clearFilter);
    return (...args) => {
        let onText = args[0];
        let options = args.length === 3 ? args[1] : undefined;
        let props = args.length === 3 ? args[2] : args[1];
        let timeout = options?.timeout ?? 750;
        return (_jsx(handle.element, { ...props, mix: on('keydown', (event) => {
                if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
                    event.stopPropagation();
                    clearTimeout(timeoutId);
                    updateFilter(text + event.key.toLowerCase(), onText);
                    timeoutId = window.setTimeout(clearFilter, timeout);
                }
                else if (event.key === 'Escape') {
                    clearFilter();
                }
                else if (event.key === 'Backspace' && text.length > 0) {
                    updateFilter(text.slice(0, -1), onText);
                }
            }) }));
    };
});
//# sourceMappingURL=filter-text.js.map