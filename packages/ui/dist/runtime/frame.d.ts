import { type FrameContent, type FrameResolution } from './component.ts';
import type { RemixElement } from './jsx.ts';
import type { ElementFunction } from './element-function.ts';
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
 * @param options Information about the active frame load or form submission.
 * @returns Frame content or a response whose body should be rendered into the frame.
 */
export type ResolveFrame = (src: string, options?: ResolveFrameOptions) => Promise<FrameResolution> | FrameResolution;
/**
 * Information available while resolving browser-loaded frame content.
 */
export interface ResolveFrameOptions {
    /** Optional name of the frame being loaded or reloaded. */
    target?: string;
    /** Form values submitted to the frame source for a non-GET submission. */
    formData?: FormData;
    /** HTTP method selected by the form and its submitter. */
    method?: string;
    /** Form encoding selected by the form and its submitter. */
    encType?: string;
    /** Aborts the reload when the navigation that started it is cancelled. */
    signal?: AbortSignal;
}
type InternalFrameContent = FrameContent | DocumentFragment;
type FrameReloadOptions = Omit<ResolveFrameOptions, 'target'>;
type FrameReloadResult = {
    signal: AbortSignal;
    redirectedTo?: string;
};
declare const FRAME_RUNTIME: unique symbol;
export type FrameRuntime = {
    [FRAME_RUNTIME]: true;
    canResolveFrames?: boolean;
    topFrame?: FrameHandle;
    errorTarget: EventTarget;
    loadModule: LoadModule;
    resolveFrame: ResolveFrame;
    pendingClientEntries: PendingClientEntries;
    scheduler: Scheduler;
    styleManager: StyleManager;
    moduleCache: Map<string, ElementFunction>;
    moduleLoads: Map<string, Promise<ElementFunction | undefined>>;
    frameInstances: WeakMap<Comment, Frame>;
    namedFrames: Map<string, FrameHandle>;
    serverFrameReload: {
        signal: AbortSignal;
        reconciliationTracker?: ReconciliationTracker;
    } | undefined;
    reloadForNavigation?: (options?: FrameReloadOptions) => Promise<FrameReloadResult>;
};
export declare function isFrameRuntime(value: unknown): value is FrameRuntime;
/**
 * Reloads a frame and returns response metadata used by the navigation runtime.
 *
 * @param frame Frame handle to reload.
 * @param options Form submission metadata and cancellation signal.
 * @returns The reload signal and final response URL, when redirected.
 */
export declare function reloadFrameForNavigation(frame: FrameHandle, options?: FrameReloadOptions): Promise<FrameReloadResult>;
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
    moduleCache: Map<string, ElementFunction>;
    moduleLoads: Map<string, Promise<ElementFunction | undefined>>;
    frameInstances: WeakMap<Comment, Frame>;
    namedFrames: Map<string, FrameHandle>;
    lifecycleSignal: AbortSignal;
    regionTailRef?: ChildNode | null;
    regionParent?: ParentNode | null;
    signal?: AbortSignal;
    shouldPreserveHeadNode?: (node: Node) => boolean;
    reconciliationTracker?: ReconciliationTracker;
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
    moduleCache: Map<string, ElementFunction>;
    moduleLoads: Map<string, Promise<ElementFunction | undefined>>;
    frameInstances: WeakMap<Comment, Frame>;
    namedFrames: Map<string, FrameHandle>;
};
export type Frame = {
    render: (content: InternalFrameContent, options?: RenderOptions) => Promise<void>;
    ready: () => Promise<void>;
    flush: () => void;
    clearPendingTemplateWatch: () => void;
    isDisplayingResolvedContent: () => boolean;
    beginClientFrameReloadForAncestorReload: (signal: AbortSignal) => {
        controller: AbortController;
        complete: () => void;
    };
    cancelReload: () => void;
    startInheritedReload: (signal?: AbortSignal) => void;
    updateMarker: (marker: FrameMarkerData, options?: RenderOptions) => Promise<void>;
    renderMarkerContent: (marker: FrameMarkerData, content: InternalFrameContent, options?: RenderOptions) => Promise<void>;
    matchesIdentity: (src: string, name: string | undefined) => boolean;
    dispose: () => void;
    handle: FrameHandle;
};
type RenderOptions = {
    flushKind?: FlushKind;
    reconciliationTracker?: ReconciliationTracker;
    signal?: AbortSignal;
    contentStatus?: 'pending' | 'resolved';
    data?: RmxData;
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
    moduleCache: Map<string, ElementFunction>;
    moduleLoads: Map<string, Promise<ElementFunction | undefined>>;
    frameInstances: WeakMap<Comment, Frame>;
    namedFrames: Map<string, FrameHandle>;
    reloadForNavigation?: (options?: FrameReloadOptions) => Promise<FrameReloadResult>;
}): FrameRuntime;
export type ReconciliationTracker = {
    track: () => () => void;
    waitFor: (task: Promise<void>) => void;
    finalize: () => void;
    ready: () => Promise<void>;
};
export declare function publishFrameTemplate(id: string, fragment: DocumentFragment): void;
export declare function consumeFrameTemplate(id: string): DocumentFragment | null;
export {};
