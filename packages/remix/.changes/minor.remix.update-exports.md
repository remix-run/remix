BREAKING CHANGE: Removed the deprecated `remix/component`, `remix/component/jsx-runtime`, `remix/component/jsx-dev-runtime`, and `remix/component/server` package exports. Import the consolidated UI runtime from `remix/ui`, `remix/ui/jsx-runtime`, `remix/ui/jsx-dev-runtime`, and `remix/ui/server` instead.

Removed `package.json` `bin` commands:

- `remix-test`

Added `package.json` `exports`:

- `remix/node-fetch-server/test` to re-export APIs from `@remix-run/node-fetch-server/test`
- `remix/terminal` to re-export APIs from `@remix-run/terminal`
- `remix/test/cli` to re-export APIs from `@remix-run/test/cli`

Added `package.json` `exports` for the consolidated UI runtime:

- `remix/ui` to re-export APIs from `@remix-run/ui`
- `remix/ui/jsx-runtime` to re-export APIs from `@remix-run/ui/jsx-runtime`
- `remix/ui/jsx-dev-runtime` to re-export APIs from `@remix-run/ui/jsx-dev-runtime`
- `remix/ui/server` to re-export APIs from `@remix-run/ui/server`
- `remix/ui/animation` to re-export APIs from `@remix-run/ui/animation`
- `remix/ui/accordion` to re-export APIs from `@remix-run/ui/accordion`
- `remix/ui/anchor` to re-export APIs from `@remix-run/ui/anchor`
- `remix/ui/breadcrumbs` to re-export APIs from `@remix-run/ui/breadcrumbs`
- `remix/ui/button` to re-export APIs from `@remix-run/ui/button`
- `remix/ui/combobox` to re-export APIs from `@remix-run/ui/combobox`
- `remix/ui/glyph` to re-export APIs from `@remix-run/ui/glyph`
- `remix/ui/listbox` to re-export APIs from `@remix-run/ui/listbox`
- `remix/ui/menu` to re-export APIs from `@remix-run/ui/menu`
- `remix/ui/popover` to re-export APIs from `@remix-run/ui/popover`
- `remix/ui/scroll-lock` to re-export APIs from `@remix-run/ui/scroll-lock`
- `remix/ui/select` to re-export APIs from `@remix-run/ui/select`
- `remix/ui/separator` to re-export APIs from `@remix-run/ui/separator`
- `remix/ui/theme` to re-export APIs from `@remix-run/ui/theme`
- `remix/ui/test` to re-export APIs from `@remix-run/ui/test`
