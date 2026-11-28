# Browser Checks for UI Changes

Select the check that matches the changed behavior. Use the app's existing browser
tools and tests, with controls and selectors inspected in the current page.
Exercise the user path rather than calling internal state setters to produce the
expected result. Use task-owned test data and browser contexts for repeated runs.

Compare the same journey before and after the change. Keep viewport, content,
cache, network and media preferences equivalent, and record the browser version.
Confirm emulated preferences with `matchMedia` after any navigation, new context
or recording operation that might reset them. Retain meaningful regressions in
the app's tests across its supported browsers.

## Layout stability

For a known shift, reproduce the image or font load, interaction, or frame
navigation that causes it. A reload-only metric cannot clear a defect that
happens later. Preserve image dimensions and responsive sources when fixing
image-related shifts.

Record the measurement window and sample variation. Missing or unsupported
metrics remain unverified. A low CLS score, including zero before and after,
does not prove the target shift was removed: CLS excludes shifts with
`hadRecentInput`. Inspect the relevant `layout-shift` entries or compare element
positions during the failing journey when the score does not capture it.

The [performance guide](https://developer.chrome.com/docs/modern-web-guidance/guides/performance/performance)
can inform the fix; verify the particular shift rather than treating a general
score threshold as its acceptance test.

## Reduced motion

Restore the interaction's initial state, confirm
`matchMedia('(prefers-reduced-motion: reduce)').matches`, and exercise it under
both preferences. Observe the property that actually moves while it is moving:
hover scale, an animated transform, or the result of a scrolling interaction.
An unchanged `transitionDuration` at rest says little about reduced movement.

Check the intended reduced behavior and the normal interaction's final state.
An intentional short fade can still be appropriate. Active animations and video
can help explain the result, but animation counts or recordings alone are not
assertions. Wait for the relevant settled condition rather than a fixed delay.

## Theme preference

For [dark mode](https://developer.chrome.com/docs/modern-web-guidance/guides/visual-design/dark-mode),
account for the app's stored choice before emulating the OS preference. Test a
System or unset choice separately from an explicit Light or Dark choice. Verify
the app's documented precedence rather than assuming an OS change overrides it.

Inspect the intended surfaces, text contrast and native controls. Any color
difference is not sufficient evidence. When changing theme initialization, check
first paint as well as enhanced navigation.

## Modal focus and background interaction

Apply modal checks to a modal contract. A non-modal popover can correctly leave
the background interactive. Open through the actual trigger and verify the
chosen initial focus target. For a native modal dialog, `matches(':modal')`
establishes its open mode; background elements need not have `.inert === true`.

Exercise Tab and Shift+Tab, and attempt to activate a harmless background control.
Confirm that its action did not occur. Focus inside alone or a click-tool error
does not prove background exclusion. Native tab traversal can momentarily report
`body` as active; do not add a custom focus trap on that observation alone.

Exercise the intended dismissal actions, including Escape where allowed, then
check focus returns to the trigger or its specified successor. Reopen and close
rapidly. If the overlay can survive a component update or frame reload, check its
live open state there. Verify navigation and removal clean up owned work.

## Report the result

Keep guide URLs, measurement conditions and actual observations with the task's
evidence. Distinguish passed, failed, not applicable and unverified checks.
Screenshots support appearance; they do not prove focus or cancellation behavior.
Restore or close only the test contexts and fixtures owned by the task.

Source and license: [Modern Browser UI in Remix](modern-web.md#sources).
