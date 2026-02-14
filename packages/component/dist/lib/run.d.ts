import type { FrameContent } from './component.ts';
import type { Props } from './jsx.ts';
type HydrationScript = {
    src: string;
} & Omit<Props<'script'>, 'children' | 'src' | 'type'>;
type LoadModule = (moduleUrl: HydrationScript, exportName: string, chunks: HydrationScript[]) => Promise<Function> | Function;
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
