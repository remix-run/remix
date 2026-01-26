Add client-side hydration support with `hydrate` and `hydrationRoot` exports.

The `hydrationRoot()` function marks components as hydration boundaries for selective hydration.
The `hydrate()` function finds and hydrates all marked components in the document, preserving server-rendered HTML while enabling interactivity. Also exports `createRangeRoot` and `createScheduler` utilities.
