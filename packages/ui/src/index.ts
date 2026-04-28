/// <reference types="dom-navigation" preserve="true" />

// -- Roots --
export { run } from './runtime/run.ts'
export type { AppRuntime, AppRuntimeEventMap, RunInit } from './runtime/run.ts'
export type { ComponentErrorEvent } from './runtime/error-event.ts'

export { createRoot, createRangeRoot, createScheduler } from './runtime/vdom.ts'
export type { VirtualRoot, VirtualRootEventMap, VirtualRootOptions, Scheduler } from './runtime/vdom.ts'

// -- Client Entries --
export { clientEntry } from './runtime/client-entries.ts'
export type {
  SerializablePrimitive,
  SerializableObject,
  SerializableArray,
  SerializableValue,
  SerializableProps,
  EntryComponent,
} from './runtime/client-entries.ts'

// -- Components --
export { Fragment, Frame } from './runtime/component.ts'
export type {
  Task,
  Handle,
  Context,
  FrameHandleEventMap,
  FrameContent,
  FrameHandle,
  FrameProps,
} from './runtime/component.ts'
export type { LoadModule, ResolveFrame } from './runtime/frame.ts'

// -- Elements/JSX/Props --
export { createElement } from './runtime/create-element.ts'
export type {
  ElementType,
  ElementProps,
  RemixElement,
  Renderable,
  RemixNode,
  Props,
} from './runtime/jsx.ts'
export type { HostProps, LayoutAnimationConfig } from './runtime/dom.ts'
export { createMixin } from './runtime/mixins/mixin.ts'
export type { MixinDescriptor, MixinHandle, MixinType, MixInput, MixValue } from './runtime/mixins/mixin.ts'
export { TypedEventTarget } from './runtime/typed-event-target.ts'
export { addEventListeners } from './runtime/event-listeners.ts'
export { on } from './runtime/mixins/on-mixin.ts'
export type { Dispatched } from './runtime/mixins/on-mixin.ts'
export { link } from './runtime/mixins/link-mixin.ts'
export { ref } from './runtime/mixins/ref-mixin.ts'
export type { RefCallback } from './runtime/mixins/ref-mixin.ts'
export { attrs } from './runtime/mixins/attrs-mixin.tsx'
export { css } from './style/css-mixin.ts'
export type { CSSMixinDescriptor } from './style/css-mixin.ts'

// -- Navigation --
export { navigate } from './runtime/navigation.ts'
export type { NavigationOptions } from './runtime/navigation.ts'
