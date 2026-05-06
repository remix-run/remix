import type { ElementProps, ElementType, RemixNode, Renderable } from './jsx.ts';
import { TypedEventTarget } from './typed-event-target.ts';
/**
 * Task queued to run after a component update completes.
 */
export type Task = (signal: AbortSignal) => void;
/**
 * Runtime handle passed to component setup functions.
 */
export interface Handle<Props = Record<string, never>, ContextValue = NoContext> {
    /**
     * Stable identifier per component instance. Useful for HTML APIs like
     * htmlFor, aria-owns, etc. so consumers don't have to supply an id.
     */
    id: string;
    /**
     * Stable props object for the component instance. The object identity does not
     * change across updates, but its values are updated before each render.
     */
    props: Props;
    /**
     * Set and get values in an element tree for indirect ancestor/descendant
     * communication.
     */
    context: Context<ContextValue>;
    /**
     * Schedules an update for the component to render again. Returns a promise
     * that resolves with an AbortSignal after the update completes. The signal
     * is aborted when the component re-renders or is removed.
     *
     * @returns A promise that resolves with an AbortSignal after the update
     */
    update(): Promise<AbortSignal>;
    /**
     * Schedules a task to run after the next update.
     *
     * @param task
     */
    queueTask(task: Task): void;
    /**
     * The component's closest frame
     */
    frame: FrameHandle;
    /**
     * Access named frames in the current runtime tree.
     */
    frames: {
        /**
         * The root frame for the current runtime tree.
         */
        readonly top: FrameHandle;
        get(name: string): FrameHandle | undefined;
    };
    /**
     * A signal indicating the connected status of the component. When the
     * component is disconnected from the tree the signal will be aborted.
     * Useful for setup scope cleanup.
     *
     * @example Clear a timer
     * ```ts
     * function Clock(handle: Handle) {
     *   let interval = setInterval(() => {
     *     if (handle.signal.aborted) {
     *       clearInterval(interval)
     *       return
     *     }
     *     handle.update()
     *   }, 1000)
     *   return () => <span>{new Date().toString()}</span>
     * }
     * ```
     *
     * Because signals are event targets, you can also add an event instead.
     * ```ts
     * function Clock(handle: Handle) {
     *   let interval = setInterval(handle.update)
     *   handle.signal.addEventListener("abort", () => clearInterval(interval))
     *   return () => <span>{new Date().toString()}</span>
     * }
     * ```
     *
     * You don't need to check both this.signal and a render/event signal as
     * render/event signals are aborted when the component disconnects.
     */
    signal: AbortSignal;
}
/**
 * Default Handle context so types must be declared explicitly.
 */
export type NoContext = Record<string, never>;
/**
 * Component factory shape used by the Remix component runtime.
 */
export type Component<Props = ElementProps, ContextValue = NoContext> = (handle: Handle<Props, ContextValue>) => RenderFn;
/**
 * Infers the context provided by a component or handle-compatible function.
 */
export type ContextFrom<ComponentType> = ComponentType extends Component<any, infer Provided> ? Provided : ComponentType extends (handle: Handle<any, infer Provided>, ...args: any[]) => any ? Provided : never;
/**
 * Context storage API exposed on component handles.
 */
export interface Context<C> {
    /** Replaces the current context value for this component instance. */
    set(values: C): void;
    /** Reads the context value associated with the given component type. */
    get<ComponentType>(component: ComponentType): ContextFrom<ComponentType>;
    /** Reads the context value associated with the given component key. */
    get(component: ElementType | symbol): unknown | undefined;
}
/**
 * Content that can be rendered into a frame.
 */
export type FrameContent = ReadableStream<Uint8Array> | string | RemixNode;
/**
 * Events emitted by frame handles during reloads.
 */
export type FrameHandleEventMap = {
    reloadStart: Event;
    reloadComplete: Event;
};
/**
 * Public API for interacting with a frame instance.
 */
export type FrameHandle = TypedEventTarget<FrameHandleEventMap> & {
    src: string;
    reload(): Promise<AbortSignal>;
    replace(content: FrameContent): Promise<void>;
    $runtime?: unknown;
};
/**
 * Props accepted by the built-in {@link Frame} component.
 */
export interface FrameProps {
    /** Optional frame name used for targeted navigation and lookups. */
    name?: string;
    /** Source URL used when the frame loads or reloads its content. */
    src: string;
    /** Fallback content to render while the frame is pending. */
    fallback?: Renderable;
    /** Event handlers invoked for events dispatched from the frame element. */
    on?: Record<string, (event: Event, signal: AbortSignal) => void | Promise<void>>;
}
/**
 * Component factory function that receives a handle and returns a render function.
 */
export type ComponentFn<Props = Record<string, never>, ContextValue = NoContext> = (handle: Handle<Props, ContextValue>) => RenderFn;
/**
 * Render function returned by a component factory.
 */
export type RenderFn<Props = ElementProps> = (props: Props) => RemixNode;
export type { RemixNode } from './jsx.ts';
/**
 * Props accepted by the built-in {@link Fragment} component.
 */
export interface FragmentProps {
    /** Child nodes to render without adding an extra host element. */
    children?: RemixNode;
}
/**
 * Mapping of built-in component names to their prop shapes.
 */
export interface BuiltinElements {
    /** Props accepted by the built-in fragment component. */
    Fragment: FragmentProps;
    /** Props accepted by the built-in frame component. */
    Frame: FrameProps;
}
/**
 * Key type used to stabilize host elements and components during reconciliation.
 */
export type Key = string | number | bigint;
type ComponentConfig = {
    id: string;
    type: Function;
    frame: FrameHandle;
    getContext: (type: Component) => unknown;
    getFrameByName: (name: string) => FrameHandle | undefined;
    getTopFrame?: () => FrameHandle | undefined;
    signal?: AbortSignal;
};
/**
 * Runtime handle returned by {@link createComponent}.
 */
export type ComponentHandle = ReturnType<typeof createComponent>;
/**
 * Creates the internal runtime wrapper for a component instance.
 *
 * @param config Component runtime configuration.
 * @returns Component runtime helpers used by the reconciler.
 */
export declare function createComponent<C = NoContext>(config: ComponentConfig): {
    render: (props: ElementProps) => [RemixNode, Array<() => void>];
    remove: () => (() => void)[];
    setScheduleUpdate: (nextScheduleUpdate: () => void) => void;
    frame: FrameHandle;
    getContextValue: () => C | undefined;
};
/**
 * Built-in component used to render nested frame content.
 *
 * @param handle Component handle for the frame instance.
 * @returns A placeholder render function handled by the reconciler.
 */
export declare function Frame(handle: Handle<FrameProps, FrameHandle>): () => null;
/**
 * Built-in component used to group children without adding a host element.
 *
 * @param handle Component handle for the fragment instance.
 * @returns A placeholder render function handled by the reconciler.
 */
export declare function Fragment(handle: Handle<FragmentProps>): () => null;
/**
 * Creates a frame handle with default no-op implementations for testing and internal wiring.
 *
 * @param def Partial frame-handle implementation to merge with the defaults.
 * @returns A frame handle object.
 */
export declare function createFrameHandle(def?: Partial<{
    src: string;
    replace: FrameHandle['replace'];
    reload: FrameHandle['reload'];
    $runtime: FrameHandle['$runtime'];
}>): FrameHandle;
