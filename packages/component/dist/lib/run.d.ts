import type { FrameHandle } from './component.ts';
import type { ComponentErrorEvent } from './error-event.ts';
import type { LoadModule, ResolveFrame } from './frame.ts';
import { TypedEventTarget } from './typed-event-target.ts';
export type RunInit = {
    loadModule: LoadModule;
    resolveFrame?: ResolveFrame;
};
export type AppRuntimeEventMap = {
    error: ComponentErrorEvent;
};
export type AppRuntime = TypedEventTarget<AppRuntimeEventMap> & {
    ready(): Promise<void>;
    flush(): void;
    dispose(): void;
};
export declare function getTopFrame(): FrameHandle;
export declare function getNamedFrame(name: string): FrameHandle;
export declare function run(init: RunInit): AppRuntime;
