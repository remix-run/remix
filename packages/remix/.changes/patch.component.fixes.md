Rendering, hydration, and navigation fixes in `remix/component`:

- Client navigations send the page being left as the `Referer`, so servers that redirect back after a form post return to the right page. Links with an explicit `referrerpolicy` and links or forms with `rel="noreferrer"` use native document navigation.
- Frame form submissions keep the submit button's name and value when the button is disabled or removed during submission, including in Firefox.
- Back and Forward restore scroll positions more reliably in Safari and Firefox when the destination takes time to load.
- Reordering elements keeps focus, iframe documents, CSS animations, and open dialogs and popovers intact in browsers that support `moveBefore()`. Custom elements that define `connectedMoveCallback()` receive it for these moves.
- Controls disabled in server HTML with `disabled=""` stay disabled after hydration, and an element that replaces a hydrated empty string renders in the right position.
- Inputs that render again with `value={undefined}` or `checked={undefined}` keep what the visitor typed or toggled.
- Streamed child frames show their content as soon as it arrives, and a frame waiting for preloads no longer stays on its server HTML when a sibling finishes first.

See the [`@remix-run/component` changelog](https://github.com/remix-run/remix/blob/main/packages/component/CHANGELOG.md) for the complete list.
