Add a `signal` option to `renderToStream()` so request aborts can cancel pending frame rendering without invoking `onError` (see #11431).
