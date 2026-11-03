type DismissableLayerOptions = {
    getParent?(): Node | null;
    getBackdrop?(): HTMLElement | null;
    onDismiss(request: {
        reason: 'escape-key' | 'outside-click';
        event: KeyboardEvent | MouseEvent;
        target: Node | null;
    }): void;
    onParentClose?(): void;
    isInside?(target: Node): boolean;
    dismissOnEscape?(): boolean;
    dismissOnOutsideClick?(): boolean;
    stopOutsideClickPropagation?(): boolean;
};
export declare function getDismissableLayerBranch(node: HTMLElement): HTMLElement[];
export declare function observeDismissableLayers(document: Document, callback: () => void): () => void;
export declare function registerDismissableLayer(node: HTMLElement, options: DismissableLayerOptions): {
    isTop(): boolean;
    update(): void;
    dispose(): void;
};
export {};
