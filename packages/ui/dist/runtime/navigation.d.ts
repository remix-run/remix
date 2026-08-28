export type NavigationState = {
    target: string | undefined;
    src: string;
    resetScroll: boolean;
    $rmx: true;
};
/**
 * Options for client-side frame-aware navigation.
 */
export type NavigationOptions = {
    src?: string;
    target?: string;
    history?: 'push' | 'replace';
    resetScroll?: boolean;
};
/**
 * Performs a client-side transition understood by the Remix frame runtime.
 *
 * @param href Destination URL.
 * @param options Navigation options.
 */
export declare function navigate(href: string, options?: NavigationOptions): Promise<void>;
