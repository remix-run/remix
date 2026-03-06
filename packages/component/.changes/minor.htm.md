Add `html` tagged template for JSX-free element creation.

`import { html } from 'remix/component/tag'` produces the same `RemixElement` trees as JSX without a build step or compiler transform. Supports host elements, dynamic props, component types, self-closing, fragments, spread props, boolean attributes, and nested/array children.
