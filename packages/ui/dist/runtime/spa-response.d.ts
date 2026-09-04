import type { RemixNode } from './jsx.ts';
type SPAResponseData = {
    node: RemixNode;
    redirectedTo?: string;
};
/**
 * Creates and finalizes responses carrying renderable Remix nodes for the SPA runtime.
 */
export declare const spaResponse: {
    /**
     * Creates a bodyless response associated with a renderable Remix node.
     *
     * @param node Node to render when the response resolves a frame.
     * @param init Standard response status, status text, and headers.
     * @returns A response understood by the SPA runtime.
     * @throws {TypeError} When called outside a browser environment.
     */
    create(node: RemixNode, init?: ResponseInit): Response;
    /**
     * Prepares the final route response for frame resolution.
     *
     * @param response Final response returned by the SPA router.
     * @param redirectedTo Final redirect URL, when the route followed redirects.
     * @returns The same response after validating it and recording its redirect URL.
     * @throws {TypeError} When the response was not created by `spaResponse.create()`.
     */
    finalize(response: Response, redirectedTo?: string): Response;
};
export declare function getSpaResponseData(response: Response): SPAResponseData | undefined;
export {};
