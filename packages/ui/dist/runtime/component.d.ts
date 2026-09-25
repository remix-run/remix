import type { ElementProps, ElementType, RemixNode, Renderable } from './jsx.ts';
import type { ElementFunction } from './element-function.ts';
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
     * that resolves with an AbortSignal after the update completes. Call this
     * from an event handler, queued task, or other work that runs after the
     * component commits. The signal is aborted when the component re-renders or
     * is removed. Calling this during setup warns and skips the extra render;
     * the promise resolves after the initial commit.
     *
     * @returns A promise that resolves with an AbortSignal after the update
     * @throws If called during rendering or before the initial commit outside setup
     */
    update(): Promise<AbortSignal>;
    /**
     * Schedules a task to run after the next update.
     *
     * @param task Work receiving a signal aborted on the next render or component removal.
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
        /**
         * Finds a mounted frame by name.
         *
         * @param name The `name` prop of the frame to find.
         * @returns The named frame, or `undefined` when it is not mounted.
         */
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
 *
 * Context values are keyed by provider component identity. `get(Component)`
 * reads the nearest ancestor instance whose component function is exactly
 * `Component`, so nested instances of the same provider shadow outer instances
 * while different component types remain independent.
 */
export interface Context<C> {
    /**
     * Replaces this component's provided value without scheduling a render.
     * Call `handle.update()` when descendants should render with the new value.
     *
     * @param values Value to provide to descendants.
     */
    set(values: C): void;
    /**
     * Reads the nearest ancestor instance of the given component type.
     * Read during render to observe replacement values on later renders.
     *
     * @param component Provider component whose identity selects the context.
     * @returns The provider's current value. At runtime, a missing provider returns `undefined`.
     */
    get<ComponentType>(component: ComponentType): ContextFrom<ComponentType>;
    /**
     * Reads context without an inferred provider value type.
     *
     * @param component Provider component identity.
     * @returns The provider's current value, or `undefined` when no matching provider exists.
     */
    get(component: ElementType | symbol): unknown | undefined;
}
/**
 * Content that can be rendered into a frame.
 *
 * HTML strings and streams must contain trusted application content. Remix does not sanitize them
 * before parsing and reconciling them into the current document.
 */
export type FrameContent = ReadableStream<Uint8Array> | string | RemixNode;
/**
 * Value returned by a browser frame resolver.
 *
 * Response bodies are rendered as frame content regardless of status. The default browser resolver
 * accepts 2xx responses and 3xx or 4xx HTML responses. It rejects other 3xx or 4xx responses and all
 * 5xx responses. When `fetch()` followed a redirect, the response's final URL updates the frame source
 * and browser URL for a top-frame navigation.
 */
export type FrameResolution = FrameContent | Response;
/**
 * Events emitted by frame handles during reloads.
 */
export type FrameHandleEventMap = {
    /** A direct reload or an ancestor-driven reload has started. */
    reloadStart: Event;
    /** Reload processing has ended, including cancellation or failure. */
    reloadComplete: Event;
};
/**
 * Options for reloading a frame's source.
 */
export interface FrameReloadOptions {
    /** Cancels the request until the frame resolver returns; does not cancel rendering its content. */
    signal?: AbortSignal;
}
interface FrameSubmitBaseOptions {
    /** Request URL. Defaults to the form action or the frame's current source. */
    action?: string;
    /** Request method. Defaults to the form method or `post` for `FormData`. */
    method?: string;
    /** Request encoding. Defaults to the form encoding or `application/x-www-form-urlencoded`. */
    encType?: string;
    /** Cancels the request until the frame resolver returns. */
    signal?: AbortSignal;
}
/**
 * Options for submitting data and rendering the response in a frame.
 */
export type FrameSubmitOptions = (FrameSubmitBaseOptions & {
    /** Form whose successful controls are submitted. */
    data: HTMLFormElement;
    /** Submit button or input whose value and form attribute overrides are used. */
    submitter?: HTMLButtonElement | HTMLInputElement;
}) | (FrameSubmitBaseOptions & {
    /** Entries to submit without a form element. */
    data: FormData;
    submitter?: never;
});
/**
 * Public API for interacting with a frame instance.
 */
export type FrameHandle = TypedEventTarget<FrameHandleEventMap> & {
    /** Source used by the next reload. Assigning it alone does not load content or change history. */
    src: string;
    /**
     * Resolves the current source and reconciles the frame with its returned content.
     * A newer reload cancels earlier reload work. Non-cancellation errors reject the promise.
     * An already-aborted caller signal skips the reload. Once the resolver returns, caller
     * cancellation does not interrupt rendering, including streamed content and hydration.
     *
     * @param options Options for cancelling the request.
     * @returns The reload's signal, aborted if its request is cancelled or the reload is superseded or disposed.
     */
    reload(options?: FrameReloadOptions): Promise<AbortSignal>;
    /**
     * Submits data to the frame's source or a form action and renders the response in one request.
     * A newer submit or reload cancels earlier client work for this frame. This does not change
     * browser history or dispatch a native form submit event.
     *
     * @param options Form data and optional request settings.
     * @returns The submission's signal, aborted if cancelled, superseded, or disposed.
     */
    submit(options: FrameSubmitOptions): Promise<AbortSignal>;
    /**
     * Renders supplied trusted content directly without calling the resolver or changing the source.
     * HTML strings and streams are not sanitized.
     * This does not emit reload lifecycle events or change browser history.
     *
     * @param content HTML, a byte stream, or a Remix node to render into the frame.
     * @returns A promise that resolves when rendering the supplied content completes.
     */
    replace(content: FrameContent): Promise<void>;
    /** Internal runtime context used by client-rendered frame reconciliation. */
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
 * Zero-argument render function returned by a component factory.
 */
export type RenderFn = () => RemixNode;
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
export type { Key } from './key.ts';
type ComponentConfig = {
    id: string;
    type: ElementFunction;
    frame: FrameHandle;
    getContext: (type: ElementFunction) => unknown;
    getFrameByName: (name: string) => FrameHandle | undefined;
    getTopFrame?: () => FrameHandle | undefined;
    signal?: AbortSignal;
};
/**
 * Minimal structural view of the scheduler used for handle.update() so this
 * module doesn't depend on the reconciler.
 */
export interface UpdateQueue {
    enqueue(vnode: object, domParent: ParentNode): void;
}
/**
 * Runtime handle returned by {@link createComponent}.
 */
export interface ComponentHandle<C = NoContext> {
    frame: FrameHandle;
    render(nextProps: ElementProps): [RemixNode, Array<() => void>];
    remove(): Array<() => void>;
    setScheduleUpdate(queue: UpdateQueue, vnode: object, domParent: ParentNode): void;
    getContextValue(): C | undefined;
    isRemoved(): boolean;
}
/**
 * Creates the internal runtime wrapper for a component instance.
 *
 * @param config Component runtime configuration.
 * @returns Component runtime helpers used by the reconciler.
 */
export declare function createComponent<C = NoContext>(config: ComponentConfig): ComponentHandle<C>;
/**
 * Built-in component used to render nested frame content.
 *
 * @param handle Component handle for the frame instance.
 * @returns A placeholder render function handled by the reconciler.
 */
export declare function Frame(handle: Handle<FrameProps, FrameHandle>): RenderFn;
/**
 * Built-in component used to group children without adding a host element.
 *
 * @param handle Component handle for the fragment instance.
 * @returns A placeholder render function handled by the reconciler.
 */
export declare function Fragment(handle: Handle<FragmentProps>): RenderFn;
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
    submit: FrameHandle['submit'];
    $runtime: FrameHandle['$runtime'];
}>): FrameHandle;
