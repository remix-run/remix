Development fixes in `remix/assets` and `remix/component-hmr`:

- Full-page HMR reloads in WebKit no longer render stale JavaScript after a module was preloaded.
- Component HMR handles default and destructured parameters, nested declarations, assignments during render, and components that share a variable declaration with other exports. Editing the setup of a component without retained setup bindings or parameters no longer runs its setup twice.
- Source maps account for injected HMR setup code and component HMR transforms, and explicitly unmapped generated code no longer points at the preceding authored source after loader transforms or minification.

See the [`@remix-run/assets`](https://github.com/remix-run/remix/blob/main/packages/assets/CHANGELOG.md) and [`@remix-run/component-hmr`](https://github.com/remix-run/remix/blob/main/packages/component-hmr/CHANGELOG.md) changelogs for details.
