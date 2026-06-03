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

Reduced browser mixin runtime bytes by inlining one-use runtime helpers, sharing insert/reclaimed event dispatch, and calling the shared mixin update dispatcher directly from the reconciler.

Reduced a few more browser runtime bytes by removing internal source-served runtime exports and inlining the one-use frame runtime factory.

Reduced a few more browser reconciler bytes by simplifying the internal head-element host check.

Reduced a few more browser prop-patching bytes by sharing style-value normalization and CSS property-name helpers across already-downloaded runtime modules.

Reduced a few more browser component and DOM diff bytes by compacting component task draining and keyed child lookup in already-downloaded runtime modules.

Reduced a few more browser reconciler bytes by compacting SVG context, persisted mixin node, and controlled prop helper paths.

Reduced a few more browser reconciler bytes by sharing host-element adoption across hydration matches, hydration retry matches, and newly-created host elements.

Reduced a few more browser scheduler bytes by trimming redundant document selection preservation checks.

Reduced a few more browser vnode conversion bytes by sharing the safe child-flattening path for array and single children.

Reduced a few more browser runtime bytes by sharing explicit head host adoption with the regular host adoption path and trimming an empty mixin-descriptor branch.

Reduced a few more browser reconciler bytes by inlining one-use controlled prop checks.
