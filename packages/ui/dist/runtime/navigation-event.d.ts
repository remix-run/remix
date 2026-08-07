export type NavigationReplacement = {
    type: 'navigation';
    state?: unknown;
} | {
    type: 'form-submission';
    info: unknown;
    state?: unknown;
};
export declare function getLinkNavigationElement(event: NavigateEvent): Element | undefined;
export declare function getReplaceHistory(value: string | null, defaultValue: boolean): boolean;
export declare function interceptNavigation(event: NavigateEvent, options: {
    handler(): Promise<void>;
    replacement: NavigationReplacement | undefined;
}): void;
