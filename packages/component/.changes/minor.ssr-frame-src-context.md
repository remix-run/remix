Add SSR frame source context for nested frame rendering.

`renderToStream()` now accepts `frameSrc` and `topFrameSrc`, `resolveFrame()` receives a `ResolveFrameContext`, and server-rendered components can read stable `handle.frame.src` and `handle.frames.top.src` values across nested frame renders.
