type ExtendedAnchorPlacement = 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end';
export type AnchorPlacement = 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
type AnchorOffsetValue = number | ((floating: HTMLElement) => number);
export interface AnchorPoint {
    height?: number;
    width?: number;
    x: number;
    y: number;
}
export type AnchorTarget = HTMLElement | AnchorPoint;
export type AnchorOptions = {
    placement?: ExtendedAnchorPlacement;
    inset?: boolean;
    relativeTo?: string;
    offset?: AnchorOffsetValue;
    offsetX?: AnchorOffsetValue;
    offsetY?: AnchorOffsetValue;
};
export declare function anchor(floating: HTMLElement, anchorTarget: AnchorTarget, options?: AnchorOptions): () => void;
export {};
