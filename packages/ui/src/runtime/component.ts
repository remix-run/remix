import type { ElementProps, ElementType, RemixNode, Renderable } from './jsx.ts'
import type { ElementFunction } from './element-function.ts'
import type { Key } from './key.ts'
import { TypedEventTarget } from './typed-event-target.ts'

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
   * that resolves with an AbortSignal after the update completes. The signal
   * is aborted when the component re-renders or is removed.
   *
   * @returns A promise that resolves with an AbortSignal after the update
   */
  update(): Promise<AbortSignal>

  /**
   * Schedules a task to run after the next update.
   *
   * @param task
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
  /** Replaces the current context value for this component instance. */
  set(values: C): void
  /** Reads the context value from the nearest ancestor instance of the given component type. */
  get<ComponentType>(component: ComponentType): ContextFrom<ComponentType>
  /** Reads an unknown context value for an untyped lookup. */
  get(component: ElementType | symbol): unknown | undefined
}

/**
 * Content that can be rendered into a frame.
 */
export type FrameContent = ReadableStream<Uint8Array> | string | RemixNode

/**
 * Value returned by a browser frame resolver.
 *
 * A response body is rendered as frame content. When `fetch()` followed a redirect, the response's
 * final URL updates the frame source and browser URL for a top-frame navigation.
 */
export type FrameResolution = FrameContent | Response

/**
 * Events emitted by frame handles during reloads.
 */
export type FrameHandleEventMap = {
  reloadStart: Event
  reloadComplete: Event
}

/**
 * Public API for interacting with a frame instance.
 */
export type FrameHandle = TypedEventTarget<FrameHandleEventMap> & {
  src: string
  reload(): Promise<AbortSignal>
  replace(content: FrameContent): Promise<void>
  // Internal runtime context used by client-rendered Frame reconciliation.
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

export type { RemixNode } from './jsx.ts'

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
  return new ComponentRuntime<C>(config)
}

class ComponentRuntime<C = NoContext> implements ComponentHandle<C> {
  frame: FrameHandle

  #config: ComponentConfig
  #connectedController: AbortController | undefined
  #contextValue: C | undefined
  #handle: Handle<ElementProps, C>
  #props: ElementProps = {}
  #renderController: AbortController | undefined
  #renderFn: RenderFn | undefined
  #removed = false
  // The schedule target is stored as fields (updated each render) rather than
  // a closure so re-renders don't allocate a new function per component.
  #updateQueue: UpdateQueue | undefined
  #updateVNode: object | undefined
  #updateDomParent: ParentNode | undefined
  #scheduleUpdate = (): void => {
    let queue = this.#updateQueue
    if (!queue) throw new Error('scheduleUpdate not implemented')
    let vnode = this.#updateVNode
    let domParent = this.#updateDomParent
    if (!vnode || !domParent) throw new Error('scheduleUpdate target not initialized')
    queue.enqueue(vnode, domParent)
  }
  #tasks: Task[] = []

  constructor(config: ComponentConfig) {
    this.#config = config
    this.frame = config.frame
    this.#handle = this.#createHandle()
  }

  render = (nextProps: ElementProps): [RemixNode, Array<() => void>] => {
    if (this.#removed) {
      console.warn('render called after component was removed, potential application memory leak')
      return [null, []]
    }

    this.#abortRenderSignal()
    syncProps(this.#props, nextProps)

    let renderFn = this.#renderFn

    if (renderFn === undefined) {
      let initialize = this.#config.type as unknown as (handle: Handle<ElementProps, C>) => unknown
      let result = initialize(this.#handle)

      if (!isRenderFn(result)) {
        let name = this.#config.type.name || 'Anonymous'
        throw new Error(`${name} must return a render function, received ${typeof result}`)
      }

      renderFn = result
      this.#renderFn = renderFn
    }

    return [renderFn(), this.#dequeueTasks()]
  }

  remove = (): Array<() => void> => {
    if (this.#removed) return EMPTY_TASKS
    this.#removed = true
    this.#connectedController?.abort()
    this.#abortRenderSignal()
    if (this.#tasks.length === 0) return EMPTY_TASKS
    return this.#dequeueTasks((sharedAbortedSignal ??= AbortSignal.abort()))
  }

  setScheduleUpdate = (queue: UpdateQueue, vnode: object, domParent: ParentNode): void => {
    this.#updateQueue = queue
    this.#updateVNode = vnode
    this.#updateDomParent = domParent
  }

  getContextValue = (): C | undefined => this.#contextValue

  isRemoved = (): boolean => this.#removed

  #createHandle(): Handle<ElementProps, C> {
    let component = this
    let context: Context<C> = {
      set: (value: C) => {
        this.#contextValue = value
      },
      get: (type: ElementType | symbol) =>
        isElementFunction(type) ? this.#config.getContext(type) : undefined,
    }

    return {
      id: this.#config.id,
      props: this.#props,
      update: () =>
        new Promise((resolve) => {
          if (component.#removed) {
            resolve(AbortSignal.abort())
            return
          }

          this.#tasks.push((signal) => resolve(signal))
          this.#scheduleUpdate()
        }),
      queueTask: (task: Task) => {
        this.#tasks.push(task)
      },
      frame: this.#config.frame,
      frames: {
        get top() {
          return component.#config.getTopFrame?.() ?? component.#config.frame
        },
        get(name: string) {
          return component.#config.getFrameByName(name)
        },
      },
      context,
      get signal() {
        return component.#config.signal ?? component.#connectedSignal()
      },
    }
  }

  #connectedSignal(): AbortSignal {
    this.#connectedController ??= new AbortController()
    return this.#connectedController.signal
  }

  #abortRenderSignal(): void {
    this.#renderController?.abort()
    this.#renderController = undefined
  }

  #dequeueTasks(signal?: AbortSignal): Array<() => void> {
    if (this.#tasks.length === 0) return EMPTY_TASKS

    let needsSignal = signal === undefined && this.#tasks.some((task) => task.length >= 1)

    if (needsSignal) {
      this.#renderController ??= new AbortController()
    }

    signal ??= this.#renderController?.signal
    signal ??= sharedAbortedSignal ??= AbortSignal.abort()
    let tasks = this.#tasks.splice(0, this.#tasks.length)
    return tasks.map((task) => () => task(signal))
  }
}

function isRenderFn(value: unknown): value is RenderFn {
  return typeof value === 'function'
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
    if (!(key in next)) {
      delete target[key]
    }
  }

  for (let key in next) {
    target[key] = next[key]
  }
}

/**
 * Built-in component used to render nested frame content.
 *
 * @param handle Component handle for the frame instance.
 * @returns A placeholder render function handled by the reconciler.
 */
export function Frame(handle: Handle<FrameProps, FrameHandle>): RenderFn {
  void handle
  return () => null // reconciler renders
}

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
