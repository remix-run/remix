interface AnimationBackend {
    sample(): number;
    stop(): void;
    pause?(): void;
    resume?(): void;
    finished: Promise<unknown>;
}
type Axis = 'x' | 'y';
type AnimationValueKey = Axis | 'z' | 'layoutX' | 'layoutY' | 'layoutScaleX' | 'layoutScaleY';
type Priority = 'animation' | 'gesture' | 'exit';
export declare function retainAnimationHost(node: HTMLElement): {
    resolveTranslate(text: string, additive?: boolean): {
        x: number;
        y: number;
        z: number;
    };
    read(key: AnimationValueKey): number;
    claim(key: AnimationValueKey, priority: Priority, cancel?: () => void): {
        read: () => number;
        set(value: number): void;
        start(backend: AnimationBackend): void;
        release(): void;
    } | undefined;
    playStyle(property: string, frames: Keyframe[], options: KeyframeAnimationOptions): {
        animation: Animation;
        stop(): void;
    };
    pause(): void;
    resume(): void;
    stop(): void;
    useTransform(): () => void;
    setOrigin(value: string | undefined): void;
    onLayoutRebase(callback: (x: number, y: number) => {
        x: number;
        y: number;
    }): () => boolean;
    rebase(x: number, y: number): {
        x: number;
        y: number;
    };
    dispose(): void;
};
export declare function measureUntransformed(node: HTMLElement): DOMRect;
export declare function measureUntransformedBatch(nodes: Iterable<HTMLElement>, read: (node: HTMLElement, rect: DOMRect) => () => void): void;
export declare function transformProperty(): string;
export declare function createNativeAnimationPlayback(node: HTMLElement, key: AnimationValueKey, from: number, to: number, options: KeyframeAnimationOptions): {
    animation: Animation;
    backend: AnimationBackend;
};
export {};
