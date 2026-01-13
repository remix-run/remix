import type { EventListeners } from '@remix-run/interaction'
import { createContainer } from '@remix-run/interaction'
import type { ElementProps, ElementType, RemixElement, RemixNode, Renderable } from './jsx.ts'

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
   * Schedules an update for the component to render again.
   *
   * @param task A render task to run after the update completes
   */
  update(task?: Task): void

  /**
   * Schedules a task to run after the next update.
   *
   * @param task
   */
  queueTask(task: Task): void

  /**
   * Raises an error the closest Catch boundary. Useful when running outside
   * of a framework-controlled scope (ie outside of rendering or events).
   *
   * @param error The raised error
   *
   * @example
   * ```tsx
   * handle.raise(new Error("Oops"))
   * ```
   */
  raise(error: unknown): void

  /**
   * The component's closest frame
   */
  frame: FrameHandle

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

// export type FrameContent = RemixElement | Element | DocumentFragment | ReadableStream | string
export type FrameContent = DocumentFragment | string

export type FrameHandle = EventTarget & {
  reload(): Promise<void>
  replace(content: FrameContent): Promise<void>
}

export interface FrameProps {
  name?: string
  src: string
  fallback?: Renderable
  on?: EventListeners
}

export type ComponentFn<
  Context = NoContext,
  Setup = undefined,
  Props = Record<string, never>,
> = (handle: Handle<Context>, setup: Setup) => RenderFn<Props>

export type RenderFn<P = {}> = (props: P) => RemixNode

export type { RemixNode } from './jsx.ts'

// Handle is already exported as an interface above, no need to re-export

export interface CatchProps {
  children?: RemixNode
  fallback?: RemixNode | ((error: Error) => RemixNode)
}

export interface FragmentProps {
  children?: RemixNode
}

export interface BuiltinElements {
  Catch: CatchProps
  Fragment: FragmentProps
  Frame: FrameProps
}

export type Key = string | number | bigint

type ComponentConfig = {
  id: string
  type: Function
  frame: FrameHandle
  raise: (error: unknown) => void
  getContext: (type: Component) => unknown
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
  let scheduleUpdate: (task?: Task) => void = () => {
    throw new Error('scheduleUpdate not implemented')
  }

  let context: Context<C> = {
    set: (value: C) => {
      contextValue = value
    },
    get: (type: Component) => {
      return config.getContext(type)
    },
  }

  let handle: Handle<C> = {
    id: config.id,
    update: (task?: Task) => {
      if (task) taskQueue.push(task)
      scheduleUpdate()
    },
    queueTask: (task: Task) => {
      taskQueue.push(task)
    },
    raise: config.raise,
    frame: config.frame,
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
    if (connectedCtrl) connectedCtrl.abort()
    return dequeueTasks()
  }

  function setScheduleUpdate(_scheduleUpdate: (task?: Task) => void) {
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

export function Catch() {
  return (_: CatchProps) => null // reconciler renders
}

export function createFrameHandle(
  def?: Partial<{
    src: string
    replace: FrameHandle['replace']
    reload: FrameHandle['reload']
  }>,
): FrameHandle {
  return Object.assign(
    new EventTarget(),
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
