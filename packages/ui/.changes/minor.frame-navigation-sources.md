BREAKING CHANGE: The default `resolveFrame` now only fetches same-origin sources and follows same-origin redirects. Apps that load cross-origin frame content must provide a custom `resolveFrame` to `run()`.

Validate navigation source overrides regardless of the target, falling back to document navigation for invalid or cross-origin overrides.
