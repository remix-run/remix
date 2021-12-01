---
title: SVGs
---
# SVGs

Adding SVGs as components can be achieved using the following steps:

Create a file in your `app` folder called `svgs.{jsx,tsx}`

Inside that file, create an exporting function for your SVG.

```tsx filename=app/svgs.{jsx,tsx}
export function YourSVG() {
	return ();
}
```

Optional: Run your SVG through an optimiser (like [SVGO](https://jakearchibald.github.io/svgomg/)) to optimise the file.

Paste your SVG code into the function return:

```tsx [3-5]
export function YourSVG() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
			...
		</svg>
	);
}
```

Add props spread for allowing runtime customisation
```tsx [1,3]
export function YourSVG({ props }) {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
			...
		</svg>
	);
}
```
Or for Typescript:
```tsx [1-2,4]
import type { SVGProps } from "react";
export function YourSVG({ props }: { props?: SVGProps<SVGSVGElement> }) {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
			...
		</svg>
	);
}
```

Then import your SVGs like so and use them as normal JSX components:
```tsx
import { YourSVG, AnotherSVG } from "~/svgs";
```

<docs-warning>After import, you may get some errors in the console depending on the content of your SVG. This is because SVGs use hyphenated attributes and JSX needs camelcase attributes. Use these errors to find the attributes you need to change. It will tell you what to change them to.</docs-warning>
