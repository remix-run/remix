Fix full-page HMR reloads in WebKit that could render stale JavaScript after a module was preloaded. The development asset server now requires a fresh request before reusing HMR scripts.
