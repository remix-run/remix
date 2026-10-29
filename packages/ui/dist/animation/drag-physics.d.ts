interface SpringSettings {
    stiffness?: number;
    dampingRatio?: number;
}
export declare function springStep(position: number, velocity: number, target: number, dt: number, settings: SpringSettings): {
    position: number;
    velocity: number;
};
export declare function frames(update: (dt: number) => boolean): {
    stop(): void;
    pause(): void;
    resume(): void;
};
export {};
