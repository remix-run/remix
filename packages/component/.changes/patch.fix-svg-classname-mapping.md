Fix SVG `className` prop normalization to render as `class` in both client DOM updates and SSR stream output.

Also add SVG regression coverage to prevent accidental `class-name` output.
