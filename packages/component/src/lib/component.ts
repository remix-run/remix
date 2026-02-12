import type { EventListeners } from '@remix-run/interaction'
import { createContainer, TypedEventTarget } from '@remix-run/interaction'
import type { ElementProps, ElementType, RemixNode, Renderable } from './jsx.ts'

export type Task = (signal: AbortSignal) => void

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

  /**
   * Listen to an event target with automatic cleanup when the component is
   * disconnected. Ideal for listening to events on global event targets like
   * document and window (or any other event target that is reachable outside of
   * the component scope).
   *
   * @example
   * ```ts
   * function SomeComp(handle: Handle) {
   *   let keys = []
   *   handle.on(document, {
   *     keydown: (event) => {
   *       keys.push(event.key)
   *       handle.update()
   *     },
   *   })
   *   return () => <span>{keys.join(', ')}</span>
   * }
   * ```
   */
  on: <target extends EventTarget>(target: target, listeners: EventListeners<target>) => void
}

/**
 * Default Handle context so types must be declared explicitly.
 */
export type NoContext = Record<string, never>

export type Component<Context = NoContext, Setup = undefined, Props = ElementProps> = (
  handle: Handle<Context>,
  setup: Setup,
) => (props: Props) => RemixNode

export type ContextFrom<ComponentType> =
  ComponentType extends Component<infer Provided, any, any>
    ? Provided
    : ComponentType extends (handle: Handle<infer Provided>, ...args: any[]) => any
      ? Provided
      : never

export interface Context<C> {
  set(values: C): void
  get<ComponentType>(component: ComponentType): ContextFrom<ComponentType>
  get(component: ElementType | symbol): unknown | undefined
}

export type FrameContent = ReadableStream<Uint8Array> | string

export type FrameHandleEventMap = {
  reloadStart: Event
  reloadComplete: Event
}

export type FrameHandle = TypedEventTarget<FrameHandleEventMap> & {
  src: string
  reload(): Promise<AbortSignal>
  replace(content: FrameContent): Promise<void>
  // Internal runtime context used by client-rendered Frame reconciliation.
  $runtime?: unknown
}

export interface FrameProps {
  name?: string
  src: string
  fallback?: Renderable
  on?: EventListeners
}

export type ComponentFn<Context = NoContext, Setup = undefined, Props = Record<string, never>> = (
  handle: Handle<Context>,
  setup: Setup,
) => RenderFn<Props>

export type RenderFn<P = {}> = (props: P) => RemixNode

export type { RemixNode } from './jsx.ts'

// Handle is already exported as an interface above, no need to re-export

export interface FragmentProps {
  children?: RemixNode
}

export interface BuiltinElements {
  Fragment: FragmentProps
  Frame: FrameProps
}

export type Key = string | number | bigint

type ComponentConfig = {
  id: string
  type: Function
  frame: FrameHandle
  getContext: (type: Component) => unknown
  getFrameByName: (name: string) => FrameHandle | undefined
  getTopFrame?: () => FrameHandle | undefined
}

export type ComponentHandle = ReturnType<typeof createComponent>

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
    on: <target extends EventTarget>(target: target, listeners: EventListeners<target>) => {
      let container = createContainer(target, { signal: getConnectedSignal() })
      container.set(listeners)
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
      let { setup, ...propsWithoutSetup } = props as { setup?: unknown }
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

  function setScheduleUpdate(_scheduleUpdate: () => void) {
    scheduleUpdate = _scheduleUpdate
  }

  function getContextValue(): C | undefined {
    return contextValue
  }

  return { render, remove, setScheduleUpdate, frame: config.frame, getContextValue }
}

export function Frame(handle: Handle<FrameHandle>) {
  return (_: FrameProps) => null // reconciler renders
}

export function Fragment() {
  return (_: FragmentProps) => null // reconciler renders
}

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
