// -- Roots --
export { run } from './lib/run.ts'
export type { AppRuntime, RunInit } from './lib/run.ts'

export { createRoot, createRangeRoot, createScheduler } from './lib/vdom.ts'
export type { VirtualRoot, VirtualRootEventMap, VirtualRootOptions, Scheduler } from './lib/vdom.ts'

// -- Client Entries --
export { clientEntry } from './lib/client-entries.ts'
export type {
  SerializablePrimitive,
  SerializableObject,
  SerializableArray,
  SerializableValue,
  SerializableProps,
  EntryComponent,
} from './lib/client-entries.ts'

// -- Components --
export { Fragment, Frame } from './lib/component.ts'
export type {
  Task,
  Handle,
  Context,
  FrameHandleEventMap,
  FrameContent,
  FrameHandle,
  FrameProps,
} from './lib/component.ts'

// -- Elements/JSX/Props --
export { createElement } from './lib/create-element.ts'
export type {
  ElementType,
  ElementProps,
  RemixElement,
  Renderable,
  RemixNode,
  Props,
} from './lib/jsx.ts'
export type {
  HostProps,
  LayoutAnimationConfig,
  PresenceStyleProperties,
  PresenceKeyframe,
  PresenceOptions,
  PresenceConfig,
  PresenceKeyframeConfig,
  AnimateProp,
} from './lib/dom.ts'

// -- Animation --
export { spring } from './lib/spring.ts'
export type { SpringIterator, SpringPreset, SpringOptions } from './lib/spring.ts'

export { tween, easings } from './lib/tween.ts'
export type { TweenOptions, BezierCurve } from './lib/tween.ts'
