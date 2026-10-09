type ExtendedAnchorPlacement = 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end';
/**
 * Main-side and top/bottom edge alignments. `AnchorOptions` also accepts left/right edge alignments.
 */
export type AnchorPlacement = 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
type AnchorOffsetValue = number | ((floating: HTMLElement) => number);
/**
 * Viewport coordinates used as an anchor instead of an element.
 */
export interface AnchorPoint {
    /** Anchor rectangle height in pixels (defaults to `0`). */
    height?: number;
    /** Anchor rectangle width in pixels (defaults to `0`). */
    width?: number;
    /** Horizontal position in viewport pixels, such as `PointerEvent.clientX`. */
    x: number;
    /** Vertical position in viewport pixels, such as `PointerEvent.clientY`. */
    y: number;
}
/**
 * Element or viewport rectangle against which a floating element is positioned.
 */
export type AnchorTarget = HTMLElement | AnchorPoint;
/**
 * Placement and offsets used by {@link anchor}.
 */
export type AnchorOptions = {
    /** Preferred side and alignment, flipped when that improves viewport fit (defaults to `'bottom'`). */
    placement?: ExtendedAnchorPlacement;
    /** Align inside the anchor's edge instead of outside it (defaults to `false`). */
    inset?: boolean;
    /** Selector for a descendant of the floating element to align against the anchor. */
    relativeTo?: string;
    /** Distance in pixels along the placement axis, or a callback computing it (defaults to `0`). */
    offset?: AnchorOffsetValue;
    /** Additional horizontal offset in pixels, or a callback computing it (defaults to `0`). */
    offsetX?: AnchorOffsetValue;
    /** Additional vertical offset in pixels, or a callback computing it (defaults to `0`). */
    offsetY?: AnchorOffsetValue;
};
/**
 * Positions a floating element against a target and tracks geometry, scroll, and resize changes.
 *
 * Updates inline positioning and size constraints, and records the chosen side in
 * `data-anchor-placement`. Call the returned cleanup function when the surface closes or unmounts.
 * Cleanup stops tracking but leaves the last applied styles and placement attribute in place.
 *
 * @param floating Element to position.
 * @param anchorTarget Anchor element or viewport coordinates.
 * @param options Placement, alignment, and offsets.
 * @returns Cleanup function that stops polling and removes scroll and resize listeners.
 */
export declare function anchor(floating: HTMLElement, anchorTarget: AnchorTarget, options?: AnchorOptions): () => void;
export {};
