export type NavigationOptions = {
    src?: string;
    target?: string;
    history?: 'push' | 'replace';
    resetScroll?: boolean;
};
export declare function navigate(href: string, options?: NavigationOptions): Promise<void>;
export declare function startNavigationListener(signal: AbortSignal): void;
