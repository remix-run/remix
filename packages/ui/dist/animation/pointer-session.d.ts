interface Listener {
    move(event: PointerEvent): void;
    end(event: Event | undefined, cancelled: boolean): void;
}
export declare function beginPointerSession(origin: PointerEvent, window: Window): {
    capture(node: HTMLElement): void;
    attach(receiver: Listener): void;
    dispose(): void;
};
export {};
