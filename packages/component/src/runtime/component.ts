import type { ElementProps, ElementType, RemixNode, Renderable } from './core/vnode.ts'
import type { ElementFunction } from './element-function.ts'
import type { Key } from './key.ts'

/**
 * An `EventTarget` subclass with typed event maps.
 */
export class TypedEventTarget<eventMap> extends EventTarget {}

/**
 * Interface surface for {@link TypedEventTarget} with typed listener overloads.
 */
export interface TypedEventTarget<eventMap> {
  /**
   * Adds a listener for a typed event name from the event map.
   *
   * @param type Event name to listen for.
   * @param listener Listener to invoke when the event fires.
   * @param options Listener registration options.
   */
  addEventListener<type extends Extract<keyof eventMap, string>>(
    type: type,
    listener: TypedEventListener<eventMap>[type],
    options?: AddEventListenerOptions,
  ): void
  /**
   * Adds a listener using the standard untyped `EventTarget` signature.
   *
   * @param type Event name to listen for.
   * @param listener Listener to invoke when the event fires.
   * @param options Listener registration options.
   */
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void
  /**
   * Removes a listener for a typed event name from the event map.
   *
   * @param type Event name to stop listening for.
   * @param listener Previously registered listener.
   * @param options Listener removal options.
   */
  removeEventListener<type extends Extract<keyof eventMap, string>>(
    type: type,
    listener: TypedEventListener<eventMap>[type],
    options?: EventListenerOptions,
  ): void
  /**
   * Removes a listener using the standard untyped `EventTarget` signature.
   *
   * @param type Event name to stop listening for.
   * @param listener Previously registered listener.
   * @param options Listener removal options.
   */
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions,
  ): void
}

type TypedEventListener<eventMap> = {
  [key in keyof eventMap]: (event: eventMap[key]) => void
}

/**
 * Error event shape emitted by the component runtime.
 */
export type ComponentErrorEvent = ErrorEvent & {
  readonly error: unknown
}

/**
 * Creates a normalized component error event from any thrown value.
 *
 * @param error Error-like value to expose on the event.
 * @returns An `error` event carrying the original value.
 */
export function createComponentErrorEvent(error: unknown): ComponentErrorEvent {
  return new ErrorEvent('error', { error }) as ComponentErrorEvent
}

/**
 * Reads the `.error` payload from a dispatched component error event.
 *
 * @param event Event to inspect.
 * @returns The original error value, if present.
 */
export function getComponentError(event: Event): unknown {
  return (event as { error?: unknown }).error
}

/**
 * Task queued to run after a component update completes.
 */
export type Task = (signal: AbortSignal) => void

/**
 * Runtime handle passed to component setup functions.
 */
export interface Handle<Props = Record<string, never>, ContextValue = NoContext> {
  /**
   * Stable identifier per component instance. Useful for HTML APIs like
   * htmlFor, aria-owns, etc. so consumers don't have to supply an id.
   */
  id: string

  /**
   * Stable props object for the component instance. The object identity does not
   * change across updates, but its values are updated before each render.
   */
  props: Props

  /**
   * Set and get values in an element tree for indirect ancestor/descendant
   * communication.
   */
  context: Context<ContextValue>

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
  update(): Promise<AbortSignal>

  /**
   * Schedules a task to run after the next update.
   *
   * @param task Work receiving a signal aborted on the next render or component removal.
   */
  queueTask(task: Task): void

  /**
   * The component's closest frame
   */
  frame: FrameHandle

  /**
   * Access named frames in the current runtime tree.
   */
  frames: {
    /**
     * The root frame for the current runtime tree.
     */
    readonly top: FrameHandle
    /**
     * Finds a mounted frame by name.
     *
     * @param name The `name` prop of the frame to find.
     * @returns The named frame, or `undefined` when it is not mounted.
     */
    get(name: string): FrameHandle | undefined
  }

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
  signal: AbortSignal
}

/**
 * Default Handle context so types must be declared explicitly.
 */
export type NoContext = Record<string, never>

/**
 * Component factory shape used by the Remix component runtime.
 */
export type Component<Props = ElementProps, ContextValue = NoContext> = (
  handle: Handle<Props, ContextValue>,
) => RenderFn

/**
 * Infers the context provided by a component or handle-compatible function.
 */
export type ContextFrom<ComponentType> =
  ComponentType extends Component<any, infer Provided>
    ? Provided
    : ComponentType extends (handle: Handle<any, infer Provided>, ...args: any[]) => any
      ? Provided
      : never

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
  set(values: C): void
  /**
   * Reads the nearest ancestor instance of the given component type.
   * Read during render to observe replacement values on later renders.
   *
   * @param component Provider component whose identity selects the context.
   * @returns The provider's current value. At runtime, a missing provider returns `undefined`.
   */
  get<ComponentType>(component: ComponentType): ContextFrom<ComponentType>
  /**
   * Reads context without an inferred provider value type.
   *
   * @param component Provider component identity.
   * @returns The provider's current value, or `undefined` when no matching provider exists.
   */
  get(component: ElementType | symbol): unknown | undefined
}

/**
 * Content that can be rendered into a frame.
 *
 * HTML strings and streams must contain trusted application content. Remix does not sanitize them
 * before parsing and reconciling them into the current document.
 */
export type FrameContent = ReadableStream<Uint8Array> | string | RemixNode

/**
 * Value returned by a browser frame resolver.
 *
 * Response bodies are rendered as frame content regardless of status. The default browser resolver
 * accepts 2xx responses and 3xx or 4xx HTML responses. It rejects other 3xx or 4xx responses and all
 * 5xx responses. When `fetch()` followed a redirect, the response's final URL updates the frame source
 * and browser URL for a top-frame navigation.
 */
export type FrameResolution = FrameContent | Response

/**
 * Events emitted by frame handles during reloads.
 */
export type FrameHandleEventMap = {
  /** A direct reload or an ancestor-driven reload has started. */
  reloadStart: Event
  /** Reload processing has ended, including cancellation or failure. */
  reloadComplete: Event
}

/**
 * Options for reloading a frame's source.
 */
export interface FrameReloadOptions {
  /** Source to reload and retain for subsequent reloads. Defaults to the current source. */
  src?: string
  /** Form request method: `GET` or `POST`, case-insensitive. Other values default to `GET`. */
  method?: string
  /**
   * Form encoding: `application/x-www-form-urlencoded` (default), `multipart/form-data`,
   * or `text/plain`. Case-insensitive; invalid values use the default. Ignored for GET.
   */
  encType?: string
  /** Form values to submit. GET encodes them into the source query instead of a request body. */
  body?: FormData
}

/**
 * Public API for interacting with a frame instance.
 */
export type FrameHandle = TypedEventTarget<FrameHandleEventMap> & {
  /** Source used by the next reload. Assigning it alone does not load content or change history. */
  src: string
  /**
   * Resolves a source and reconciles the frame with its returned content without changing history.
   * A newer reload cancels earlier reload work. Non-cancellation errors reject the promise.
   *
   * @param options Source and request settings.
   * @returns The reload's signal, which is aborted if that reload is superseded or disposed.
   */
  reload(options?: FrameReloadOptions): Promise<AbortSignal>
  /**
   * Renders supplied trusted content directly without calling the resolver or changing the source.
   * HTML strings and streams are not sanitized.
   * This does not emit reload lifecycle events or change browser history.
   *
   * @param content HTML, a byte stream, or a Remix node to render into the frame.
   * @returns A promise that resolves when rendering the supplied content completes.
   */
  replace(content: FrameContent): Promise<void>
  /** Internal runtime context used by client-rendered frame reconciliation. */
  $runtime?: unknown
}

/**
 * Props accepted by the built-in {@link Frame} component.
 */
export interface FrameProps {
  /** Optional frame name used for targeted navigation and lookups. */
  name?: string
  /** Source URL used when the frame loads or reloads its content. */
  src: string
  /** Fallback content to render while the frame is pending. */
  fallback?: Renderable
  /** Event handlers invoked for events dispatched from the frame element. */
  on?: Record<string, (event: Event, signal: AbortSignal) => void | Promise<void>>
}

/**
 * Component factory function that receives a handle and returns a render function.
 */
export type ComponentFn<Props = Record<string, never>, ContextValue = NoContext> = (
  handle: Handle<Props, ContextValue>,
) => RenderFn

/**
 * Zero-argument render function returned by a component factory.
 */
export type RenderFn = () => RemixNode

export type { RemixNode } from './core/vnode.ts'

// Handle is already exported as an interface above, no need to re-export

/**
 * Props accepted by the built-in {@link Fragment} component.
 */
export interface FragmentProps {
  /** Child nodes to render without adding an extra host element. */
  children?: RemixNode
}

/**
 * Mapping of built-in component names to their prop shapes.
 */
export interface BuiltinElements {
  /** Props accepted by the built-in fragment component. */
  Fragment: FragmentProps
  /** Props accepted by the built-in frame component. */
  Frame: FrameProps
}

/**
 * Key type used to stabilize host elements and components during reconciliation.
 */
export type { Key } from './key.ts'

type ComponentConfig = {
  id: string
  type: ElementFunction
  frame: FrameHandle
  getContext: (type: ElementFunction) => unknown
  getFrameByName: (name: string) => FrameHandle | undefined
  getTopFrame?: () => FrameHandle | undefined
  signal?: AbortSignal
}

/**
 * Minimal structural view of the scheduler used for handle.update() so this
 * module doesn't depend on the reconciler.
 */
export interface UpdateQueue {
  enqueue(vnode: object, domParent: ParentNode): void
}

/**
 * Runtime handle returned by {@link createComponent}.
 */
export interface ComponentHandle<C = NoContext> {
  frame: FrameHandle
  render(nextProps: ElementProps): [RemixNode, Array<() => void>]
  remove(): Array<() => void>
  setScheduleUpdate(queue: UpdateQueue, vnode: object, domParent: ParentNode): void
  getContextValue(): C | undefined
  isRemoved(): boolean
}

/**
 * Creates the internal runtime wrapper for a component instance.
 *
 * @param config Component runtime configuration.
 * @returns Component runtime helpers used by the reconciler.
 */
export function createComponent<C = NoContext>(config: ComponentConfig): ComponentHandle<C> {
  let connectedController: AbortController | undefined
  let contextValue: C | undefined
  let props: ElementProps = {}
  let renderController: AbortController | undefined
  let renderFn: RenderFn | undefined
  let removed = false
  let phase: 'idle' | 'setup' | 'render' = 'idle'
  let updateQueue: UpdateQueue | undefined
  let updateVNode: object | undefined
  let updateDomParent: ParentNode | undefined
  let tasks: Task[] = []

  let context: Context<C> = {
    set(value) {
      contextValue = value
    },
    get: (type: ElementType | symbol) =>
      isElementFunction(type) ? config.getContext(type) : undefined,
  }

  let handle: Handle<ElementProps, C> = {
    id: config.id,
    props,
    update() {
      if (removed) return Promise.resolve(AbortSignal.abort())

      if (phase === 'setup') {
        console.warn(
          `Ignored handle.update() while ${getComponentName(config)} is running its setup function. The initial render includes setup changes.`,
        )
        return new Promise((resolve) => {
          tasks.push((signal) => resolve(signal))
        })
      }
      if (phase !== 'idle') {
        throw new Error(
          `Cannot call handle.update() while ${getComponentName(config)} is running its ${phase} function. Call it from an event handler or handle.queueTask() instead.`,
        )
      }
      let queue = updateQueue
      let vnode = updateVNode
      let domParent = updateDomParent
      // setScheduleUpdate() sets all three together when the initial render commits.
      if (!queue || !vnode || !domParent) {
        throw new Error(
          `Cannot call handle.update() before ${getComponentName(config)}'s initial render commits. Call it from an event handler or handle.queueTask() instead.`,
        )
      }

      return new Promise((resolve) => {
        tasks.push((signal) => resolve(signal))
        queue.enqueue(vnode, domParent)
      })
    },
    queueTask(task: Task) {
      tasks.push(task)
    },
    frame: config.frame,
    frames: {
      get top() {
        return config.getTopFrame?.() ?? config.frame
      },
      get(name: string) {
        return config.getFrameByName(name)
      },
    },
    context,
    get signal() {
      return config.signal ?? (connectedController ??= new AbortController()).signal
    },
  }

  function dequeueTasks(signal?: AbortSignal): Array<() => void> {
    if (tasks.length === 0) return EMPTY_TASKS

    if (signal === undefined && tasks.some((task) => task.length >= 1)) {
      renderController ??= new AbortController()
    }

    signal ??= renderController?.signal
    signal ??= sharedAbortedSignal ??= AbortSignal.abort()
    return tasks.splice(0, tasks.length).map((task) => () => task(signal))
  }

  return {
    frame: config.frame,
    render(nextProps) {
      if (removed) {
        console.warn('render called after component was removed, potential application memory leak')
        return [null, []]
      }

      renderController?.abort()
      renderController = undefined
      syncProps(props, nextProps)

      if (renderFn === undefined) {
        let initialize = config.type as unknown as (handle: Handle<ElementProps, C>) => unknown
        let result: unknown
        phase = 'setup'
        try {
          result = initialize(handle)
        } finally {
          phase = 'idle'
        }

        if (!isRenderFn(result)) {
          throw new Error(
            `${getComponentName(config)} must return a render function, received ${typeof result}`,
          )
        }

        renderFn = result
      }

      let element: RemixNode
      phase = 'render'
      try {
        element = renderFn()
      } finally {
        phase = 'idle'
      }

      return [element, dequeueTasks()]
    },
    remove() {
      if (removed) return EMPTY_TASKS
      removed = true
      connectedController?.abort()
      renderController?.abort()
      renderController = undefined
      if (tasks.length === 0) return EMPTY_TASKS
      return dequeueTasks((sharedAbortedSignal ??= AbortSignal.abort()))
    },
    setScheduleUpdate(queue, vnode, domParent) {
      updateQueue = queue
      updateVNode = vnode
      updateDomParent = domParent
    },
    getContextValue: () => contextValue,
    isRemoved: () => removed,
  }
}

function isRenderFn(value: unknown): value is RenderFn {
  return typeof value === 'function'
}

function getComponentName(config: ComponentConfig): string {
  return config.type.name || 'Anonymous'
}

function isElementFunction(value: unknown): value is ElementFunction {
  return typeof value === 'function'
}

// Shared empty result and aborted signal so the common no-task removal path
// (large subtree teardowns dispose many components at once) allocates nothing.
const EMPTY_TASKS: Array<() => void> = []
let sharedAbortedSignal: AbortSignal | undefined

function syncProps(target: ElementProps, next: ElementProps): void {
  for (let key in target) {
    if (!Object.hasOwn(next, key)) {
      delete target[key]
    }
  }

  for (let key in next) {
    if (key === '__proto__') {
      Object.defineProperty(target, key, {
        value: next[key],
        writable: true,
        enumerable: true,
        configurable: true,
      })
    } else {
      target[key] = next[key]
    }
  }
}

// Marks the built-in `Frame` component, which is defined with the frame runtime. The property
// holds the client frame node renderer, so the reconciler and server renderer can recognize and
// render frames without importing the frame runtime.
export const FRAME_NODE = Symbol('FrameNode')

/**
 * Built-in component used to group children without adding a host element.
 *
 * @param handle Component handle for the fragment instance.
 * @returns A placeholder render function handled by the reconciler.
 */
export function Fragment(handle: Handle<FragmentProps>): RenderFn {
  void handle
  return () => null // reconciler renders
}

/**
 * Creates a frame handle with default no-op implementations for testing and internal wiring.
 *
 * @param def Partial frame-handle implementation to merge with the defaults.
 * @returns A frame handle object.
 */
export function createFrameHandle(
  def?: Partial<{
    src: string
    replace: FrameHandle['replace']
    reload: FrameHandle['reload']
    $runtime: FrameHandle['$runtime']
  }>,
): FrameHandle {
  return Object.assign(
    new TypedEventTarget<FrameHandleEventMap>(),
    {
      src: '/',
      replace: notImplemented('replace not implemented'),
      reload: notImplemented('reload not implemented'),
    },
    def,
  )
}

function notImplemented(msg: string) {
  return (): never => {
    throw new Error(msg)
  }
}
