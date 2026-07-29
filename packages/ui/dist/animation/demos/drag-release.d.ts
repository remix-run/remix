export declare const dragVelocityReleaseEventType: "rmx:drag-velocity-release";
declare global {
    interface HTMLElementEventMap {
        [dragVelocityReleaseEventType]: DragVelocityEvent;
    }
}
export declare class DragVelocityEvent extends Event {
    clientX: number;
    clientY: number;
    velocityX: number;
    velocityY: number;
    constructor(type: typeof dragVelocityReleaseEventType, init: {
        clientX: number;
        clientY: number;
        velocityX: number;
        velocityY: number;
    });
}
declare const baseDragVelocityEvents: import("@remix-run/ui").MixinFactory<HTMLElement, [], import("@remix-run/ui").ElementProps>;
type DragVelocityEventsMixin = typeof baseDragVelocityEvents & {
    readonly release: typeof dragVelocityReleaseEventType;
};
export declare const dragVelocityEvents: DragVelocityEventsMixin;
export {};
