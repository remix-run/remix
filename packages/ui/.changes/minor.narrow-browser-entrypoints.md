Added narrow browser-facing entrypoints for Remix UI runtime APIs: `@remix-run/ui/run`, `@remix-run/ui/client-entry`, `@remix-run/ui/on`, and `@remix-run/ui/css`. These let source-served browser modules import only the client runtime pieces they need instead of loading the full `@remix-run/ui` barrel.

Reduced the runtime loaded by those narrow entrypoints by splitting lightweight mixin descriptors from the full mixin reconciliation runtime and moving `Fragment` out of the component runtime used by the JSX runtime.

Reduced the core browser reconciliation runtime by removing an empty-child bulk-clear fast path whose recursive safety checks added more downloaded JavaScript than they saved in typical hydrated pages.

Reduced duplicate browser event runtime by letting `on()` handlers use the normal mixin lifecycle instead of carrying a separate direct-event fast path in the reconciler.

Reduced browser DOM diff runtime by merging removed-subtree cleanup passes for hydrated roots and nested frames.

Reduced browser frame runtime by merging frame-region cleanup passes for hydrated roots and nested frames.

Reduced browser reconciliation runtime by simplifying controlled form reflection state.

Reduced a few more bytes from the browser reconciliation and frame runtime by inlining controlled property reflection helpers, removing an unused mixin binding argument, and dropping a redundant own-property check after `Object.keys()`.

Reduced browser frame runtime by merging rmx-data root scanning and avoiding unnecessary query-result arrays.

Reduced the browser attribute patching runtime by moving SSR-only omitted-prop and self-closing-tag tables into the server renderer.

Reduced browser virtual root runtime by sharing root scheduling, error forwarding, disposal, and frame-stub setup between `createRoot()` and `createRangeRoot()`.

Reduced browser DOM diff and style runtime bytes by removing temporary attribute-set construction, using smaller selector checks, and dropping an unused internal style-cache export.

Reduced a few more browser runtime bytes by removing unused internal virtual-root re-exports and passing frame accessors into the navigation listener instead of importing them back from the app runtime.
