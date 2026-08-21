Make `addEventListeners()` a no-op during server rendering so SSR signals are not passed to brand-checking runtimes such as Cloudflare Workers and listeners are not retained across requests.
