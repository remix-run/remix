Added `package.json` `exports`:

- `remix/components/accordion`
- `remix/components/anchor` to re-export APIs from `@remix-run/ui/components/anchor`
- `remix/components/breadcrumbs`
- `remix/components/button` to re-export APIs from `@remix-run/ui/components/button`
- `remix/components/checkbox`
- `remix/components/combobox`
- `remix/components/input` to re-export APIs from `@remix-run/ui/components/input`
- `remix/components/listbox` to re-export APIs from `@remix-run/ui/components/listbox`
- `remix/components/menu`
- `remix/components/popover` to re-export APIs from `@remix-run/ui/components/popover`
- `remix/components/select`
- `remix/ui/button` to re-export APIs from `@remix-run/ui/button`
- `remix/ui/checkbox` to re-export APIs from `@remix-run/ui/checkbox`
- `remix/ui/input` to re-export APIs from `@remix-run/ui/input`

Updated `remix/route-pattern` exports for the `RoutePattern` API:

- Added `getRoutePatternCaptures`, `RoutePatternCapture`, and `RoutePatternJSON` to `remix/route-pattern`
- Added `CreateHrefErrorDetails` to `remix/route-pattern/href`
- Added `MatchParamMeta` to `remix/route-pattern/match`

Removed `package.json` `exports`:

- `remix/components/anchor/primitives`
- `remix/components/button/primitives`
- `remix/components/input/primitives`
- `remix/components/listbox/primitives`
- `remix/components/popover/primitives`
- `remix/ui/breadcrumbs`
- `remix/ui/glyph`
- `remix/ui/separator`
- `remix/ui/theme`
