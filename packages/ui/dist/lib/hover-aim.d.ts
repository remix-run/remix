export interface HoverAim {
    start(source: HTMLElement, target: HTMLElement, event?: PointerEvent, onExpire?: () => void): boolean;
    accepts(event: PointerEvent): boolean;
}
export declare function createHoverAim(): HoverAim;
