import { createRoot } from "./vdom.js";
/**
 * Mounts a {@link RemixNode} into a DOM container for testing.
 *
 * @param node - The node to render
 * @param opts - {@link RenderOptions}; pass `opts.container` to render into a specific
 *   element instead of a fresh `div` appended to `document.body`
 * @returns A {@link RenderResult} with the container, root, and helpers for querying and
 *   interacting with the rendered output.
 */
export function render(node, opts = {}) {
    let { container: userContainer, ...virtualRootOpts } = opts;
    let container;
    if (userContainer) {
        container = userContainer;
    }
    else {
        container = document.createElement('div');
        document.body.appendChild(container);
    }
    let root = createRoot(container, virtualRootOpts);
    root.render(node);
    root.flush();
    let ctx = {
        get container() {
            if (!container)
                throw new Error('Test container has already been cleaned up');
            return container;
        },
        get root() {
            if (!root)
                throw new Error('Test root has already been cleaned up');
            return root;
        },
        $: (s) => ctx.container.querySelector(s),
        $$: (s) => ctx.container.querySelectorAll(s),
        async act(fn) {
            await fn();
            ctx.root.flush();
        },
        cleanup() {
            root?.dispose();
            container?.remove();
            container = undefined;
            root = undefined;
        },
    };
    return ctx;
}
//# sourceMappingURL=render.js.map