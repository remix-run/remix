type FocusScopeOptions = {
    modal: boolean | 'trap-focus';
    initialFocus?: HTMLElement | false | null;
    returnFocus?: HTMLElement | false | null | (() => HTMLElement | false | null);
    getBackdrop?: () => HTMLElement | null;
    onFocusOutside?: (event: FocusEvent) => void;
};
export declare function activateFocusScope(node: HTMLElement, options: FocusScopeOptions): {
    update(options: {
        modal: boolean | 'trap-focus';
    }): void;
    dispose(options?: {
        restoreFocus?: boolean;
    }): void;
};
export {};
