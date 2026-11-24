# Modern Browser UI in Remix

Use this reference when adapting a browser example to Remix, or changing native
overlays, motion, themes or layout stability. Read the relevant installed guide
and API README through `node_modules/remix/INDEX.md` first; they define the API
contract for the app's version.

## Select the relevant browser guidance

Use the [Chrome Modern Web Guidance catalog](https://developer.chrome.com/docs/modern-web-guidance/guides)
to find the guide for the behavior being changed. Read that guide rather than
applying the whole catalog. Keep its URL and retrieval date with task evidence.
Retrieve the documentation directly; a guide does not require adopting its CLI.

Check feature support against the app's supported browser versions. A Baseline
label or passing tests in current engines does not establish support in older
clients. Keep a working fallback when a new native feature is an enhancement.
Prefer existing Remix primitives when they already provide the required behavior.

## Translate browser examples

Remix components are not React. Keep server-rendered content and add browser work
to the smallest existing client entry that owns the interaction.

| Browser example         | Remix implementation                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native attributes       | Check the installed JSX declarations for spellings such as `popover`, `popovertarget`, `commandfor` and `fetchpriority`. A type assertion does not add browser or framework support.                                                  |
| Control and label IDs   | Use `handle.id`, adding distinct suffixes when an instance needs multiple IDs.                                                                                                                                                        |
| Event listeners         | Use `on()` from `remix/component` for user interactions. Pass its signal to work that should stop when that handler runs again or its element is removed.                                                                             |
| Element-owned DOM work  | Use `ref((node, signal) => ...)` from `remix/component` after insertion. Disconnect observers and cancel element-owned work when that signal aborts.                                                                                  |
| DOM work after a render | Use `handle.queueTask()` or await `handle.update()` before reading the committed DOM. Check the signal before continuing; queued callbacks can run with an aborted signal. Setup and render can run on the server.                    |
| Component styles        | Use `css()` from `remix/component`. Self-selectors need `&`, such as `&:modal`, `&::backdrop` and `&[open]`; `:modal` alone selects descendants. Nest relevant `@media`, `@supports` and `@starting-style` rules beside their styles. |

Choose the lifetime that matches the work. A queued task's signal expires on the
next render or removal; `handle.signal` lasts until the component is removed.
Use the installed component README for the full cancellation contract.

Document-wide theme rules and standalone rules such as `@property`,
`@position-try` and `@view-transition` belong in the stylesheet that owns them,
rather than inside a mixin-generated class.

## Preserve overlay and motion behavior

Choose whether the overlay blocks the page before following the
[dialog guide](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-components/dialog).
A modal opened with `showModal()` and a non-modal popover have different focus,
dismissal and background-interaction contracts. Preserve the intended trigger,
close actions and focus destination. Open in response to the app's URL, state or
user action rather than adding an unconditional mount-time opening.

For [top-layer animation](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/animate-to-from-top-layer),
verify live open state through component updates and frame reloads. Native DOM
state and JSX attributes need not change together. Reproduce a suspected runtime
gap before proposing a framework fix.

For [motion](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/motion),
keep the usable final state when reducing or removing movement. CSS media queries
govern CSS motion. If the app uses Remix UI animation mixins, read its installed
animation README: `prefersReducedMotion()` from `@remix-run/ui/animation` reads
the current preference but does not subscribe to changes, and the mixins do not
check it automatically. Check the preference at the relevant render or playback.

Use the matching [browser checks](browser-checks.md) to verify the actual user
path, including SSR, enhanced navigation and removal where they affect the change.

## Sources

Browser verification guidance is adapted from the
[agent-browser Modern Web Guidance skill](https://github.com/vercel-labs/agent-browser/tree/25b5d76f2843bce7be6c59a56d3461b162ad4ac9/skill-data/modern-web-guidance),
snapshot `25b5d76f2843bce7be6c59a56d3461b162ad4ac9`, under
[Apache-2.0](modern-web-license.txt). The local adaptation uses installed Remix
contracts and browser checks independent of a particular automation tool.
External guides remain linked references; consult their current text for each task.
