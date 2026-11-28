/// <reference types="dom-navigation" preserve="true" />

// -- Roots --
export { defaultResolveFrame, run } from './runtime/run.ts'
export type { DefaultResolveFrameOverrides } from './runtime/run.ts'
export type { FrameCommit, FrameCommitContext } from './runtime/frame.ts'
export type { AppRuntime, AppRuntimeEventMap, RunInit } from './runtime/run.ts'
export type { ComponentErrorEvent, FrameReloadStartEvent } from './runtime/component.ts'

export { createRoot, createRangeRoot, createScheduler } from './runtime/vdom.ts'
export type {
  VirtualRoot,
  VirtualRootEventMap,
  VirtualRootOptions,
  Scheduler,
} from './runtime/vdom.ts'

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
export { Fragment, TypedEventTarget, unsafeHTML } from './runtime/vnode.ts'
export type { UnsafeHTML } from './runtime/vnode.ts'
export { Portal } from './runtime/portal.ts'
export { Frame } from './runtime/frame.ts'
export type { PortalProps } from './runtime/component.ts'
export type { FrameUpdateDetail, FrameUpdateEvent } from './runtime/frame.ts'
export type {
  Task,
  Handle,
  Context,
  FrameHandleEventMap,
  FrameContent,
  FrameHandle,
  FrameReloadOptions,
  FrameProps,
} from './runtime/component.ts'
export type { LoadModule, ResolveFrame, ResolveFrameOptions } from './runtime/frame-runtime.ts'
export { spaResponse } from './runtime/spa-response.ts'

// -- Elements/JSX/Props --
export { createElement } from './runtime/create-element.ts'
export type {
  ElementType,
  ElementProps,
  RemixElement,
  Renderable,
  RemixNode,
  Props,
} from './runtime/vnode.ts'
export type { HostProps, LayoutAnimationConfig } from './runtime/dom.ts'
export { createMixin } from './runtime/mixins/mixin.ts'
export type {
  MixinDescriptor,
  MixinFactory,
  MixinHandle,
  MixinOptions,
  MixinType,
  MixInput,
  MixValue,
} from './runtime/mixins/mixin.ts'
export type { Dispatched } from './runtime/event-types.ts'
export { on } from './runtime/mixins/on-mixin.ts'
export { link } from './runtime/mixins/link-mixin.ts'
export { ref } from './runtime/mixins/ref-mixin.ts'
export type { RefCallback } from './runtime/mixins/ref-mixin.ts'
export { attrs } from './runtime/mixins/attrs-mixin.ts'
export { css } from './style/css-mixin.ts'
export type { CSSMixinDescriptor } from './style/css-mixin.ts'

// -- Navigation --
export { navigate } from './runtime/navigation.ts'
export type { NavigationEvent, NavigationOptions } from './runtime/navigation.ts'
export { updateUrl } from './runtime/update-url.ts'
export type { UpdateUrlOptions } from './runtime/update-url.ts'
export { defaultPrefetch, prefetch } from './runtime/prefetch.ts'
export type {
  DefaultPrefetchOverrides,
  PrefetchAnchorOptions,
  PrefetchFrame,
  PrefetchFrameOptions,
  ProcessFrameContext,
  PrefetchFrameReference,
  PrefetchOptions,
  PrefetchReferences,
} from './runtime/prefetch.ts'
