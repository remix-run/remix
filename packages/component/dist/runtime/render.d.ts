import type { RemixNode } from './jsx.ts';
import { type VirtualRoot, type VirtualRootOptions } from './vdom.ts';
/**
 * Options for {@link render}.
 */
export interface RenderOptions extends VirtualRootOptions {
    /**
     * The element to mount the component into. Defaults to a fresh `div` appended to
     * `document.body`.
     */
    container?: HTMLElement;
}
/**
 * Result returned by {@link render}.
 */
export interface RenderResult {
    /**
     * The element the component is mounted into.
     */
    container: HTMLElement;
    /**
     * The {@link VirtualRoot} the component is rendered in. Use it to access the
     * underlying scheduler or dispatch lifecycle events.
     */
    root: VirtualRoot;
    /**
     * Shorthand for `container.querySelector<HTMLElement>(selector)`.
     */
    $: (selector: string) => HTMLElement | null;
    /**
     * Shorthand for `container.querySelectorAll<HTMLElement>(selector)`.
     */
    $$: (selector: string) => NodeListOf<HTMLElement>;
    /**
     * Runs `fn` and then flushes any pending component updates so the DOM reflects them
     * before the next assertion.
     */
    act: (fn: () => unknown | Promise<unknown>) => Promise<void>;
    /**
     * Disposes the root and removes the container from the DOM. Pass to `t.after()` for
     * automatic cleanup at the end of a test.
     */
    cleanup: () => void;
}
/**
 * Mounts a {@link RemixNode} into a DOM container for testing.
 *
 * @param node - The node to render
 * @param opts - {@link RenderOptions}; pass `opts.container` to render into a specific
 *   element instead of a fresh `div` appended to `document.body`
 * @returns A {@link RenderResult} with the container, root, and helpers for querying and
 *   interacting with the rendered output.
 */
export declare function render(node: RemixNode, opts?: RenderOptions): RenderResult;
