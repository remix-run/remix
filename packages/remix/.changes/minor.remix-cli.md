Added `package.json` `exports`:

- `remix/cli` to expose the Remix CLI programmatic API
- `remix/ui/accordion` to re-export APIs from `@remix-run/ui/accordion`
- `remix/ui/anchor` to re-export APIs from `@remix-run/ui/anchor`
- `remix/ui/breadcrumbs` to re-export APIs from `@remix-run/ui/breadcrumbs`
- `remix/ui/button` to re-export APIs from `@remix-run/ui/button`
- `remix/ui/combobox` to re-export APIs from `@remix-run/ui/combobox`
- `remix/ui/glyph` to re-export APIs from `@remix-run/ui/glyph`
- `remix/ui/listbox` to re-export APIs from `@remix-run/ui/listbox`
- `remix/ui/menu` to re-export APIs from `@remix-run/ui/menu`
- `remix/ui/on-outside-pointer-down` to re-export APIs from `@remix-run/ui/on-outside-pointer-down`
- `remix/ui/popover` to re-export APIs from `@remix-run/ui/popover`
- `remix/ui/scroll-lock` to re-export APIs from `@remix-run/ui/scroll-lock`
- `remix/ui/select` to re-export APIs from `@remix-run/ui/select`
- `remix/ui/separator` to re-export APIs from `@remix-run/ui/separator`
- `remix/ui/theme` to re-export APIs from `@remix-run/ui/theme`

Added a `remix` `package.json` `bin` command that delegates to `@remix-run/cli`, reads the current Remix version from the `remix` package, and declares Node.js 24.3.0 or later in package metadata.
