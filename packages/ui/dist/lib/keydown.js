import { createMixin, on } from '@remix-run/component';
export const onKeyDown = createMixin(() => (key, handler) => on('keydown', (event) => {
    if (event.key === key) {
        event.preventDefault();
        handler(event);
    }
}), { ssr: false });
//# sourceMappingURL=keydown.js.map