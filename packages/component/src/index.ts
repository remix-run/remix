/// <reference types="dom-navigation" preserve="true" />

// -- Roots --
export { run } from './lib/run.ts'
export type { AppRuntime, AppRuntimeEventMap, RunInit } from './lib/run.ts'
export type { ComponentErrorEvent } from './lib/component.ts'

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
export { Fragment } from './lib/component.ts'
export { Frame } from './lib/frame.ts'
export type {
  Task,
  Handle,
  Context,
  FrameHandleEventMap,
  FrameContent,
  FrameHandle,
  FrameReloadOptions,
  FrameProps,
} from './lib/component.ts'
export type { LoadModule, ResolveFrame, ResolveFrameOptions } from './lib/frame-runtime.ts'
export { spaResponse } from './lib/spa-response.ts'

// -- Elements/JSX/Props --
export { createElement } from './lib/create-element.ts'
export type {
  ElementType,
  ElementProps,
  RemixElement,
  Renderable,
  RemixNode,
  Props,
} from './lib/core/vnode.ts'
export type { HostProps, LayoutAnimationConfig } from './lib/dom.ts'
export { unsafeHTML } from './lib/unsafe-html.ts'
export type { UnsafeHTML } from './lib/unsafe-html.ts'
export { createMixin } from './lib/mixins/mixin.ts'
export type {
  MixinDescriptor,
  MixinFactory,
  MixinHandle,
  MixinOptions,
  MixinType,
  MixInput,
  MixValue,
} from './lib/mixins/mixin.ts'
export { TypedEventTarget } from './lib/component.ts'
export type { Dispatched } from './lib/event-types.ts'
export { on } from './lib/mixins/on-mixin.ts'
export { link } from './lib/mixins/link-mixin.ts'
export { ref } from './lib/mixins/ref-mixin.ts'
export type { RefCallback } from './lib/mixins/ref-mixin.ts'
export { attrs } from './lib/mixins/attrs-mixin.ts'
export { css } from './lib/mixins/css-mixin.ts'
export type { CSSMixinDescriptor } from './lib/mixins/css-mixin.ts'

// -- Navigation --
export { navigate, updateUrl } from './lib/navigation.ts'
export type { NavigationOptions, UpdateUrlOptions } from './lib/navigation.ts'
export { prefetch } from './lib/prefetch.ts'
export type { PrefetchFrame, PrefetchOptions } from './lib/prefetch.ts'
