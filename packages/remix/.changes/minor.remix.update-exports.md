BREAKING CHANGE: Removed the deprecated `remix/component`, `remix/component/jsx-runtime`, `remix/component/jsx-dev-runtime`, and `remix/component/server` package exports. Import the consolidated UI runtime from `remix/ui`, `remix/ui/jsx-runtime`, `remix/ui/jsx-dev-runtime`, and `remix/ui/server` instead.

Added `package.json` `exports` for the consolidated UI runtime:

- `remix/ui` to re-export APIs from `@remix-run/ui`
- `remix/ui/jsx-runtime` to re-export APIs from `@remix-run/ui/jsx-runtime`
- `remix/ui/jsx-dev-runtime` to re-export APIs from `@remix-run/ui/jsx-dev-runtime`
- `remix/ui/server` to re-export APIs from `@remix-run/ui/server`
- `remix/ui/animation` to re-export APIs from `@remix-run/ui/animation`
