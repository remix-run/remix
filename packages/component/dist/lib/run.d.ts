import type { FrameContent } from './component.ts';
type LoadModule = (moduleUrl: string, exportName: string) => Promise<Function> | Function;
type ResolveFrame = (src: string, signal?: AbortSignal) => Promise<FrameContent> | FrameContent;
export type RunInit = {
    loadModule: LoadModule;
    resolveFrame?: ResolveFrame;
};
export type AppRuntime = EventTarget & {
    ready(): Promise<void>;
    flush(): void;
    dispose(): void;
};
export declare function run(doc: Document, init: RunInit): AppRuntime;
export {};
