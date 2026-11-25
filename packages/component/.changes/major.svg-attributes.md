SVG elements now pass attribute names through as written instead of converting React-style camelCase prop names (such as `strokeWidth`, `strokeLinecap`, or `xmlLang`) to kebab-case or XML/XLink namespaces. Only `className` (normalized to `class`) and `xlinkHref` / `xlink:href` (normalized to SVG2 `href`) are rewritten.

This removes the camelCase SVG attribute lookup table and `setAttributeNS` handling from the client and server renderers, reducing runtime size while matching standard SVG markup. `SVGProps` types also remove the non-standard camelCase aliases so TypeScript flags them at compile time.

Update SVG JSX props to use standard SVG attribute names (kebab-case for hyphenated attributes like `stroke-width` and `stroke-linecap`, and camelCase for canonical SVG attributes like `viewBox` and `clipPathUnits`):

```diff
 <svg viewBox="0 0 24 24" fill="none">
-  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
+  <path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" />
 </svg>
```
