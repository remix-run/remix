`createRequestListener()` now accepts request-only handlers separately from handlers that read client address information, so handlers such as `router.fetch` can be passed directly.
