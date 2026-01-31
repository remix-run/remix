/**
 * Layout animation system using FLIP technique with Web Animations API.
 *
 * Based on Motion's projection system:
 * - Box/Axis/Delta data structures for precise layout calculations
 * - Proper FLIP (First, Last, Invert, Play) algorithm
 * - Interruptible animations using WAAPI
 */
interface LayoutAnimationConfig {
    duration?: number;
    easing?: string;
}
export declare function markLayoutSubtreePending(root: ParentNode): void;
export declare function captureLayoutSnapshots(): void;
export declare function applyLayoutAnimations(): void;
export declare function registerLayoutElement(el: Element, config: LayoutAnimationConfig): void;
export declare function updateLayoutElement(el: Element, config: LayoutAnimationConfig): void;
export declare function unregisterLayoutElement(el: Element): void;
export {};
