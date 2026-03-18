type ExtendedAnchorPlacement = 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end';
export type AnchorPlacement = 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
export type AnchorOptions = {
    placement?: ExtendedAnchorPlacement;
    inset?: boolean;
    relativeTo?: string;
    offset?: number;
};
export declare function anchor(floating: HTMLElement, anchorElement: HTMLElement, options?: AnchorOptions): () => void;
export {};
