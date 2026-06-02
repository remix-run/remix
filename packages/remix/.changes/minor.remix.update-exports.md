Added narrow browser-facing Remix UI subpath exports:

- `remix/ui/client-entry`
- `remix/ui/css`
- `remix/ui/on`
- `remix/ui/run`

Added a narrow route pattern parse subpath export:

- `remix/route-pattern/parse`

Source-served browser assets now compile selected broad `remix/ui` named imports to those narrower subpaths automatically.
