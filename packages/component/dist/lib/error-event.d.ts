export type ComponentErrorEvent = ErrorEvent & {
    readonly error: unknown;
};
export declare function createComponentErrorEvent(error: unknown): ComponentErrorEvent;
export declare function getComponentError(event: Event): unknown;
