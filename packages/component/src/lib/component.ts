import type { EventListeners } from '@remix-run/interaction'
import { createContainer } from '@remix-run/interaction'

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
   * this.raise(new Error("Oops"))
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
   * function Clock() {
   *   let interval = setInterval(() => {
   *     if (this.signal.aborted) {
   *       clearInterval(interval)
   *       return
   *     }
   *     this.render()
   *   }, 1000)
   *   return () => <span>{new Date().toString()}</span>
   * }
   * ```
   *
   * Because signals are event targets, you can also add an event instead.
   * ```ts
   * function Clock() {
   *   let interval = setInterval(this.render)
   *   this.signal.addEventListener("abort", () => clearInterval(interval))
   *   return () => <span>{new Date().toString()}</span>
   * }
   * ```
   *
   * @discussion
   * You don't need to check both this.signal and a render/event signal as
   * render/event signals are aborted when the component disconnects
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
   * function SomeComp() {
   *   let keys = []
   *   this.on(document, {
   *     keydown: (event) => {
   *       keys.push(event.key)
   *       this.update()
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

export type Component<
  Context = NoContext,
  SetupProps = Remix.ElementProps,
  RenderProps = Remix.ElementProps,
> = (this: Handle<Context>, props: SetupProps) => Remix.Node | ((props: RenderProps) => Remix.Node)

export type ContextFrom<ComponentType> =
  ComponentType extends Component<infer Provided, any, any>
    ? Provided
    : ComponentType extends (this: Handle<infer Provided>, ...args: any[]) => any
      ? Provided
      : never

export interface Context<C> {
  set(values: C): void
  get<ComponentType>(component: ComponentType): ContextFrom<ComponentType>
  get(component: Remix.ElementType | symbol): unknown | undefined
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
  fallback?: Remix.Renderable
  on?: EventListeners
}

export type ComponentProps<T> = T extends {
  (props: infer Setup): infer R
}
  ? R extends (props: infer Render) => any
    ? Setup & Render
    : Setup
  : never

export interface CatchProps {
  children?: Remix.Node
  fallback?: Remix.Node | ((error: Error) => Remix.Node)
}

export interface FragmentProps {
  children?: Remix.Node
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
  let renderCtrl = new AbortController()
  let connectedCtrl = new AbortController()
  let contextValue: C | undefined = undefined

  let getContent: null | ((props: Remix.ElementProps) => Remix.Node) = null
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
    signal: connectedCtrl.signal,
    on: <target extends EventTarget>(target: target, listeners: EventListeners<target>) => {
      let container = createContainer(target, { signal: connectedCtrl.signal })
      container.set(listeners)
    },
  }

  function dequeueTasks() {
    return taskQueue.splice(0, taskQueue.length).map((task) => task.bind(handle, renderCtrl.signal))
  }

  function render(props: Remix.ElementProps): [Remix.Node, Array<() => void>] {
    if (connectedCtrl.signal.aborted) {
      console.warn('render called after component was removed, potential application memory leak')
      return [null, []]
    }

    renderCtrl.abort()
    renderCtrl = new AbortController()

    if (!getContent) {
      let result = config.type.call(handle, props)
      if (typeof result === 'function') {
        getContent = (props) => result.call(handle, props, renderCtrl.signal)
      } else {
        getContent = (props) => config.type.call(handle, props)
      }
    }

    let node = getContent(props)
    return [node, dequeueTasks()]
  }

  function remove(): (() => void)[] {
    connectedCtrl.abort()
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

export function Frame(this: Handle<FrameHandle>, _: FrameProps) {
  return null // reconciler renders
}

export function Fragment(_: FragmentProps) {
  return null // reconciler renders
}

export function Catch(_: CatchProps) {
  return null // reconciler renders
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
