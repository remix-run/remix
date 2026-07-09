/**
 * A parsed stream directive describing one boundary of an out-of-order region.
 */
export interface StreamDirective {
    /** Which boundary this directive marks. */
    kind: 'start' | 'end';
    /** Region identifier shared by the matching `<template for>` element. */
    id: string;
}
/**
 * Serializes the opening directive for an out-of-order streaming region.
 *
 * @param id Region identifier shared with the resolving `<template for>`.
 * @returns The `<?start name="id">` processing instruction.
 */
export declare function streamStartDirective(id: string): string;
/**
 * Serializes the closing directive for an out-of-order streaming region.
 *
 * @param id Region identifier shared with the resolving `<template for>`.
 * @returns The `<?end name="id">` processing instruction.
 */
export declare function streamEndDirective(id: string): string;
/**
 * Reads a stream directive from a DOM node, handling both native processing
 * instructions (nodeType 7) and the comment fallback (nodeType 8) produced by
 * browsers that do not yet parse the instructions.
 *
 * @param node Node to inspect.
 * @returns The parsed directive, or `null` when the node is not a directive.
 */
export declare function getStreamDirective(node: Node | null | undefined): StreamDirective | null;
/**
 * Reports whether a node is any stream directive boundary.
 *
 * @param node Node to inspect.
 * @returns `true` when the node is a `<?start>` or `<?end>` directive.
 */
export declare function isStreamDirective(node: Node | null | undefined): boolean;
/**
 * Detects whether the current browser natively processes the declarative
 * `<?start>` / `<?end>` streaming directives. When it does, the browser owns
 * the out-of-order DOM swap and the polyfill must not run.
 *
 * @param doc Document used to build the probe. Defaults to the global document.
 * @returns `true` when the parser produces a processing instruction node.
 */
export declare function supportsStreamDirectives(doc?: Document): boolean;
/**
 * The matching `<?start>` and `<?end>` directives that delimit one out-of-order
 * streaming region.
 */
export interface StreamRegion {
    /** The opening directive node. */
    start: Node;
    /** The closing directive node. */
    end: Node;
}
/**
 * Finds the directive pair that delimits the region with the given id.
 *
 * @param id Region identifier to locate.
 * @param doc Document to search. Defaults to the global document.
 * @returns The matching region, or `null` when either boundary is missing.
 */
export declare function findStreamRegion(id: string, doc?: Document): StreamRegion | null;
/**
 * Moves a `<template for>` element's content into its matching directive region,
 * replacing the placeholder content and removing the directives and template.
 * This is the polyfill for browsers without native directive support; native
 * browsers perform the same move without JavaScript.
 *
 * @param template Template element addressed by a `for` attribute.
 * @param doc Document that owns the template. Defaults to the global document.
 * @returns The resolved region id when a swap occurred, otherwise `null`.
 */
export declare function swapStreamTemplate(template: HTMLTemplateElement, doc?: Document): string | null;
/**
 * Installs the MutationObserver polyfill that moves `<template for>` content
 * into its directive region as templates stream into the document. No-op and
 * returns an inert disposer when the browser supports the directives natively.
 *
 * @param doc Document to observe. Defaults to the global document.
 * @param onSwap Optional callback invoked with the region id after each swap.
 * @returns A function that disconnects the observer.
 */
export declare function installStreamTemplateMover(doc?: Document, onSwap?: (id: string) => void): () => void;
