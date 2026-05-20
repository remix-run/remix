import { type FrameContent } from './component.ts';
import type { RemixElement } from './jsx.ts';
import type { FrameHandle } from './component.ts';
import type { Scheduler } from './vdom.ts';
import { createRangeRoot } from './vdom.ts';
import { type StyleManager } from '../style/index.ts';
import { type FlushKind } from './stream-protocol.ts';
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
/**
 * Loads a named client-entry export for hydration.
 *
 * @param moduleUrl Browser-resolvable URL for the module that contains the client entry.
 * @param exportName Named export to read from the loaded module.
 * @returns The exported component function, or a promise for it.
 *
 * @example
 * ```ts
 * run({
 *   async loadModule(moduleUrl, exportName) {
 *     let mod = await import(moduleUrl)
 *     return mod[exportName]
 *   },
 * })
 * ```
 */
export type LoadModule = (moduleUrl: string, exportName: string) => Promise<Function> | Function;
/**
 * Resolves content for a browser-loaded frame.
 *
 * @param src Source string from the `<Frame src>` prop.
 * @param signal Abort signal for the active frame load or reload.
 * @param target Optional name of the frame being reloaded.
 * @returns HTML, a stream of HTML bytes, or Remix node content to render into the frame.
 */
export type ResolveFrame = (src: string, signal?: AbortSignal, target?: string) => Promise<FrameContent> | FrameContent;
type InternalFrameContent = FrameContent | DocumentFragment;
export type FrameRuntime = {
    topFrame?: FrameHandle;
    errorTarget: EventTarget;
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
    errorTarget: EventTarget;
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
    errorTarget: EventTarget;
    loadModule: LoadModule;
    resolveFrame: ResolveFrame;
    pendingClientEntries: PendingClientEntries;
    scheduler: Scheduler;
    styleManager?: StyleManager;
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
    flushKind?: FlushKind;
    initialHydrationTracker?: InitialHydrationTracker;
    signal?: AbortSignal;
};
export declare function createFrame(root: FrameRoot, init: FrameInit): Frame;
export declare function createFrameRuntime(init: {
    topFrame?: FrameHandle;
    errorTarget: EventTarget;
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
