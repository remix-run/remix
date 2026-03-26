import type { ElementProps, ElementType, RemixNode, Renderable } from './jsx.ts'
import { TypedEventTarget } from './typed-event-target.ts'

/**
 * Task queued to run after a component update completes.
 */
export type Task = (signal: AbortSignal) => void

/**
 * Runtime handle passed to component setup functions.
 */
export interface Handle<C = Record<string, never>> {
  /**
   * Stable identifier per component instance. Useful for HTML APIs like
   * htmlFor, aria-owns, etc. so consumers don't have to supply an id.
   */
  id: string

  /**
   * Set and get values in an element tree for indirect ancestor/descendant
   * communication.
   */
  context: Context<C>

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
export type Component<Context = NoContext, Setup = undefined, Props = ElementProps> = (
  handle: Handle<Context>,
  setup: Setup,
) => (props: Props) => RemixNode

/**
 * Infers the context provided by a component or handle-compatible function.
 */
export type ContextFrom<ComponentType> =
  ComponentType extends Component<infer Provided, any, any>
    ? Provided
    : ComponentType extends (handle: Handle<infer Provided>, ...args: any[]) => any
      ? Provided
      : never

/**
 * Context storage API exposed on component handles.
 */
export interface Context<C> {
  /** Replaces the current context value for this component instance. */
  set(values: C): void
  /** Reads the context value associated with the given component type. */
  get<ComponentType>(component: ComponentType): ContextFrom<ComponentType>
  /** Reads the context value associated with the given component key. */
  get(component: ElementType | symbol): unknown | undefined
}

/**
 * Content that can be rendered into a frame.
 */
export type FrameContent = ReadableStream<Uint8Array> | string | RemixNode

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
 * Component factory function that receives setup input and returns a render function.
 */
export type ComponentFn<Context = NoContext, Setup = undefined, Props = Record<string, never>> = (
  handle: Handle<Context>,
  setup: Setup,
) => RenderFn<Props>

/**
 * Render function returned by a component factory.
 */
export type RenderFn<P = {}> = (props: P) => RemixNode

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
export type Key = string | number | bigint

type ComponentConfig = {
  id: string
  type: Function
  frame: FrameHandle
  getContext: (type: Component) => unknown
  getFrameByName: (name: string) => FrameHandle | undefined
  getTopFrame?: () => FrameHandle | undefined
}

/**
 * Runtime handle returned by {@link createComponent}.
 */
export type ComponentHandle = ReturnType<typeof createComponent>

/**
 * Creates the internal runtime wrapper for a component instance.
 *
 * @param config Component runtime configuration.
 * @returns Component runtime helpers used by the reconciler.
 */
export function createComponent<C = NoContext>(config: ComponentConfig) {
  let taskQueue: Task[] = []
  let renderCtrl: AbortController | null = null
  let connectedCtrl: AbortController | null = null
  let contextValue: C | undefined = undefined

  function getConnectedSignal() {
    if (!connectedCtrl) connectedCtrl = new AbortController()
    return connectedCtrl.signal
  }

  let getContent: null | ((props: ElementProps) => RemixNode) = null
  let scheduleUpdate: () => void = () => {
    throw new Error('scheduleUpdate not implemented')
  }

  let context: Context<C> = {
    set: (value: C) => {
      contextValue = value
    },
    get: (type: Component) => config.getContext(type),
  }

  let handle: Handle<C> = {
    id: config.id,
    update: () =>
      new Promise((resolve) => {
        taskQueue.push((signal) => resolve(signal))
        scheduleUpdate()
      }),
    queueTask: (task: Task) => {
      taskQueue.push(task)
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
    context: context,
    get signal() {
      return getConnectedSignal()
    },
  }

  function dequeueTasks(): (() => void)[] {
    // Only create render controller if any task expects a signal (has length >= 1)
    let needsSignal = taskQueue.some((task) => task.length >= 1)
    if (needsSignal && !renderCtrl) {
      renderCtrl = new AbortController()
    }
    let signal = renderCtrl?.signal
    return taskQueue.splice(0, taskQueue.length).map((task) => () => task(signal!))
  }

  function render(props: ElementProps): [RemixNode, Array<() => void>] {
    if (connectedCtrl?.signal.aborted) {
      console.warn('render called after component was removed, potential application memory leak')
      return [null, []]
    }

    // Only abort render controller if it was initialized
    if (renderCtrl) {
      renderCtrl.abort()
      renderCtrl = null
    }

    if (!getContent) {
      // Extract setup prop (passed to component setup function, not render)
      let { setup } = props as { setup?: unknown }
      let result = config.type(handle, setup)
      if (typeof result !== 'function') {
        let name = config.type.name || 'Anonymous'
        throw new Error(`${name} must return a render function, received ${typeof result}`)
      } else {
        getContent = (props) => {
          // Strip setup from props since it's only for setup
          let { setup: _, ...rest } = props as { setup?: unknown }
          return result(rest)
        }
      }
    }

    let node = getContent(props)
    return [node, dequeueTasks()]
  }

  function remove(): (() => void)[] {
    connectedCtrl?.abort()
    renderCtrl?.abort()
    return dequeueTasks()
  }

  function setScheduleUpdate(nextScheduleUpdate: () => void) {
    scheduleUpdate = nextScheduleUpdate
  }

  function getContextValue(): C | undefined {
    return contextValue
  }

  return { render, remove, setScheduleUpdate, frame: config.frame, getContextValue }
}

/**
 * Built-in component used to render nested frame content.
 *
 * @param handle Component handle for the frame instance.
 * @returns A placeholder render function handled by the reconciler.
 */
export function Frame(handle: Handle<FrameHandle>) {
  void handle
  return (_: FrameProps) => null // reconciler renders
}

/**
 * Built-in component used to group children without adding a host element.
 *
 * @returns A placeholder render function handled by the reconciler.
 */
export function Fragment() {
  return (_: FragmentProps) => null // reconciler renders
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
