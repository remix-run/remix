Update `remix/component` and `remix/component/server` to re-export the latest `@remix-run/component` frame-navigation APIs.

`remix/component` now exposes `navigate(href, { src, target, history })`, `run({ loadModule, resolveFrame })`, and the `handle.frames.top` and `handle.frames.get(name)` helpers, while `remix/component/server` re-exports the SSR frame source APIs including `frameSrc`, `topFrameSrc`, and `ResolveFrameContext`.
