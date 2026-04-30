import { createMixin, on } from '@remix-run/ui';
export const onKeyDown = createMixin(() => (key, handler) => on('keydown', (event) => {
    if (event.key === key) {
        event.preventDefault();
        handler(event);
    }
}));
//# sourceMappingURL=keydown.js.map