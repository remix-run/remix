import { type FrameContent } from './component.ts';
import type { RemixElement } from './jsx.ts';
import type { FrameHandle } from './component.ts';
import type { Scheduler } from './vdom.ts';
import { createRangeRoot } from './vdom.ts';
import type { StyleManager } from './style/index.ts';
type FrameRoot = [Comment, Comment] | Element | Document | DocumentFragment;
type FrameData = {
    status: 'pending' | 'resolved';
    name?: string;
    src: string;
};
type HydrationData = {
    moduleUrl: string;
    exportName: string;
    props: Record<string, unknown>;
};
type RmxData = {
    h?: Record<string, HydrationData>;
    f?: Record<string, FrameData>;
};
export type VirtualRootMarker = Comment & {
    $rmx: ReturnType<typeof createRangeRoot>;
};
type FrameMarkerData = FrameData & {
    id: string;
};
type PendingClientEntries = Map<Comment, [Comment, RemixElement]>;
export type LoadModule = (moduleUrl: string, exportName: string) => Promise<Function> | Function;
export type ResolveFrame = (src: string, signal?: AbortSignal) => Promise<FrameContent> | FrameContent;
type InternalFrameContent = FrameContent | DocumentFragment;
export type FrameRuntime = {
    topFrame?: FrameHandle;
    loadModule: LoadModule;
    resolveFrame: ResolveFrame;
    pendingClientEntries: PendingClientEntries;
    scheduler: Scheduler;
    styleManager: StyleManager;
    data: RmxData;
    moduleCache: Map<string, Function>;
    moduleLoads: Map<string, Promise<Function | undefined>>;
    frameInstances: WeakMap<Comment, Frame>;
    namedFrames: Map<string, FrameHandle>;
};
export type FrameContext = {
    topFrame?: FrameHandle;
    loadModule: LoadModule;
    resolveFrame: ResolveFrame;
    pendingClientEntries: PendingClientEntries;
    scheduler: Scheduler;
    frame: FrameHandle;
    styleManager: StyleManager;
    data: RmxData;
    moduleCache: Map<string, Function>;
    moduleLoads: Map<string, Promise<Function | undefined>>;
    frameInstances: WeakMap<Comment, Frame>;
    namedFrames: Map<string, FrameHandle>;
    regionTailRef?: ChildNode | null;
    regionParent?: ParentNode | null;
};
type FrameInit = {
    name?: string;
    topFrame?: FrameHandle;
    src: string;
    loadModule: LoadModule;
    resolveFrame: ResolveFrame;
    pendingClientEntries: PendingClientEntries;
    scheduler: Scheduler;
    styleManager: StyleManager;
    marker?: FrameMarkerData;
    data: RmxData;
    moduleCache: Map<string, Function>;
    moduleLoads: Map<string, Promise<Function | undefined>>;
    frameInstances: WeakMap<Comment, Frame>;
    namedFrames: Map<string, FrameHandle>;
};
export type Frame = {
    render: (content: InternalFrameContent, options?: RenderOptions) => Promise<void>;
    ready: () => Promise<void>;
    flush: () => void;
    dispose: () => void;
    handle: FrameHandle;
};
type RenderOptions = {
    initialHydrationTracker?: InitialHydrationTracker;
    signal?: AbortSignal;
};
export declare function createFrame(root: FrameRoot, init: FrameInit): Frame;
export declare function createFrameRuntime(init: {
    topFrame?: FrameHandle;
    loadModule: LoadModule;
    resolveFrame: ResolveFrame;
    pendingClientEntries: PendingClientEntries;
    scheduler: Scheduler;
    styleManager: StyleManager;
    data: RmxData;
    moduleCache: Map<string, Function>;
    moduleLoads: Map<string, Promise<Function | undefined>>;
    frameInstances: WeakMap<Comment, Frame>;
    namedFrames: Map<string, FrameHandle>;
}): FrameRuntime;
type InitialHydrationTracker = {
    track: () => () => void;
    finalize: () => void;
    ready: () => Promise<void>;
};
export declare function publishFrameTemplate(id: string, fragment: DocumentFragment): void;
export declare function consumeFrameTemplate(id: string): DocumentFragment | null;
export {};
