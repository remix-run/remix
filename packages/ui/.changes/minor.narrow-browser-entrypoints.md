Added narrow browser-facing entrypoints for Remix UI runtime APIs: `@remix-run/ui/run`, `@remix-run/ui/client-entry`, `@remix-run/ui/on`, and `@remix-run/ui/css`. These let source-served browser modules import only the client runtime pieces they need instead of loading the full `@remix-run/ui` barrel.

Reduced the runtime loaded by those narrow entrypoints by splitting lightweight mixin descriptors from the full mixin reconciliation runtime and moving `Fragment` out of the component runtime used by the JSX runtime.
