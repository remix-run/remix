Added `package.json` `exports`:

- `remix/components/accordion`
- `remix/components/breadcrumbs`
- `remix/components/combobox`
- `remix/components/menu`
- `remix/components/select`
- `remix/components/tabs`
- `remix/ui/button` to re-export APIs from `@remix-run/ui/button`
- `remix/ui/input` to re-export APIs from `@remix-run/ui/input`

Updated `remix/route-pattern` exports for the `RoutePattern` API:

- Added `getRoutePatternCaptures`, `RoutePatternCapture`, and `RoutePatternJSON` to `remix/route-pattern`
- Added `CreateHrefErrorDetails` to `remix/route-pattern/href`
- Added `MatchParamMeta` to `remix/route-pattern/match`

Removed `package.json` `exports`:

- `remix/components/button`
- `remix/ui/breadcrumbs`
- `remix/ui/glyph`
- `remix/ui/separator`
- `remix/ui/theme`
