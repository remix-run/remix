import type { UiDocs } from './docs/types.ts'
import { referenceTable } from './docs/reference-table.tsx'

export default {
  title: 'Popover',
  slug: 'popover',
  category: 'primitives',
  description: 'Anchored floating panels with dismissal and focus restoration.',
  importPath: '@remix-run/ui/popover',
  examples: [
    {
      id: 'basic',
      title: 'Basic',
      description: '',
      previewSize: 'compact',
      module: new URL('./popover/basic.example.tsx', import.meta.url),
    },
    {
      id: 'editable-anchor-example',
      title: 'Editable anchor',
      description: '',
      section: 'anchor-interaction',
      previewSize: 'compact',
      module: new URL('./popover/editable-anchor.example.tsx', import.meta.url),
    },
  ],
  sections: [
    {
      id: 'anatomy',
      title: 'Anatomy',
      content() {
        return <p>Wrap the anchor, surface and focus targets in the same provider.</p>
      },
      code: [
        {
          source:
            "import * as popover from '@remix-run/ui/popover'\n\n<popover.Context>\n  <button\n    type=\"button\"\n    mix={[\n      popover.anchor({ placement: 'bottom-start', offset: 8 }),\n      popover.focusOnHide(),\n      on('click', () => { open = true\n        handle.update() }),\n    ]}\n  >Filters</button>\n  <div mix={popover.surface({\n    open,\n    onHide() { open = false\n      handle.update() },\n  })}>\n    <input aria-label=\"Filter projects\" mix={popover.focusOnShow()} />\n  </div>\n</popover.Context>",
        },
      ],
    },
    {
      id: 'state',
      title: 'Opening and dismissal',
      content() {
        return (
          <p>
            <code>surface()</code> requires an <code>open</code> boolean. <code>onHide</code>{' '}
            requests closure for Escape or an outside click. Update <code>open</code> to accept the
            request. Opening uses the browser’s top layer and locks page scrolling.
          </p>
        )
      },
      code: [
        {
          source:
            'popover.surface({\n  open,\n  onHide(request) {\n    open = false\n    handle.update()\n  },\n})',
        },
      ],
    },
    {
      id: 'position',
      title: 'Positioning',
      content() {
        return (
          <p>
            <code>anchor()</code> accepts placement, offsets, inset and relative alignment from the
            Anchor API. The surface tracks geometry changes and flips when needed to fit the
            viewport.
          </p>
        )
      },
      code: [{ source: "popover.anchor({ placement: 'bottom-end', offset: 8 })" }],
    },
    {
      id: 'anchor-interaction',
      title: 'Interactive anchors',
      content() {
        return (
          <p>
            Set <code>closeOnAnchorClick</code> to false when the anchor must remain interactive
            while the surface is open. This is useful for inputs that update a floating preview.
          </p>
        )
      },
    },
    {
      id: 'focus',
      title: 'Focus targets',
      content() {
        return (
          <p>
            <code>focusOnShow()</code> registers the initial focus target.{' '}
            <code>focusOnHide()</code> registers the return target. Targets must be focusable. Set{' '}
            <code>restoreFocusOnHide</code> to false when closure should leave focus where the user
            moved it.
          </p>
        )
      },
      code: [
        {
          source:
            '<button mix={popover.focusOnHide()}>Open filters</button>\n\n<div mix={popover.surface({ open, onHide, restoreFocusOnHide: false })}>\n  <input aria-label="Filter projects" mix={popover.focusOnShow()} />\n</div>',
        },
      ],
    },
    {
      id: 'motion',
      title: 'Transitions',
      content() {
        return (
          <p>
            Native popover transitions can use <code>:popover-open</code>,{' '}
            <code>@starting-style</code> and discrete transitions for <code>display</code> and{' '}
            <code>overlay</code>. Keeping the surface in the top layer through exit lets opacity
            finish animating.
          </p>
        )
      },
      code: [
        {
          source:
            "<div mix={[\n  css({\n    opacity: 0,\n    transition: 'opacity 140ms ease, display 140ms allow-discrete, overlay 140ms allow-discrete',\n    '&:popover-open': { opacity: 1, '@starting-style': { opacity: 0 } },\n    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },\n  }),\n  popover.surface({ open, onHide }),\n]} />",
        },
      ],
    },
    {
      id: 'accessibility',
      title: 'Accessibility',
      content() {
        return (
          <p>
            The surface does not add a role, accessible name or focus trap. Choose semantics for its
            content. Use an accessible name for dialog-like panels and add{' '}
            <code>aria-expanded</code> and <code>aria-controls</code> to their triggers. Keep a
            keyboard path to dismissal.
          </p>
        )
      },
      code: [
        {
          source:
            '<button aria-expanded={open} aria-controls="project-filters">Filters</button>\n<div id="project-filters" role="dialog" aria-label="Project filters" mix={popover.surface({ open, onHide })} />',
        },
      ],
    },
    {
      id: 'api-reference',
      title: 'API reference',
      content() {
        return (
          <>
            <h3 id="context-reference">Context</h3>
            <p>
              Provides <code>PopoverContext</code> for one floating surface. Only accepts{' '}
              <code>children</code>.
            </p>
            {referenceTable(
              ['Provided member', 'Type', 'Meaning'],
              [
                [
                  'anchor',
                  '{ target: AnchorTarget, options: AnchorOptions } | null',
                  'Registered positioning target.',
                ],
                ['surface', 'HTMLElement | null', 'Registered floating root.'],
                [
                  'showFocusTarget, hideFocusTarget',
                  'HTMLElement | null',
                  'Registered focus targets.',
                ],
              ],
            )}
            <h3 id="anchor-reference">anchor(options)</h3>
            <p>
              Registers its host as the anchor. Requires an options object, which may be empty.
              Accepts all <code>AnchorOptions</code>. Does not decorate the element with trigger
              semantics.
            </p>
            <h3 id="surface-reference">surface(options)</h3>
            {referenceTable(
              ['Option', 'Type', 'Behavior'],
              [
                ['open', 'boolean', 'Required controlled open state.'],
                [
                  'onHide',
                  '(request?: PopoverHideRequest) => void',
                  'Required dismissal callback.',
                ],
                [
                  'closeOnAnchorClick',
                  'boolean',
                  'Defaults to true. False excludes anchor clicks from outside dismissal.',
                ],
                [
                  'restoreFocusOnHide',
                  'boolean',
                  'Defaults to true. Returns focus to the registered hide target.',
                ],
                [
                  'stopOutsideClickPropagation',
                  'boolean',
                  'Defaults to true. Stops the outside click after requesting dismissal.',
                ],
              ],
            )}
            {referenceTable(
              ['Decoration', 'Value', 'Meaning'],
              [['popover', 'manual', 'Controls the native top-layer surface.']],
            )}
            <h3 id="focus-on-show-reference">focusOnShow()</h3>
            <p>Registers its host as the focus target when the surface opens.</p>
            <h3 id="focus-on-hide-reference">focusOnHide()</h3>
            <p>Registers its host as the focus target when the surface closes.</p>
            <h3 id="hide-request-reference">PopoverHideRequest</h3>
            {referenceTable(
              ['Property', 'Type', 'Meaning'],
              [
                ['reason', "'escape-key' | 'outside-click'", 'Dismissal trigger.'],
                ['target', 'Node | null | undefined', 'Outside-click target. Absent for Escape.'],
              ],
            )}
            <h3 id="types-reference">Exported types</h3>
            {referenceTable(
              ['Type', 'Purpose'],
              [
                ['PopoverProps', 'Provider children.'],
                ['PopoverContext', 'Registered surface, anchor and focus targets.'],
                ['PopoverSurfaceOptions', 'Controlled state and dismissal options.'],
                ['PopoverHideRequest', 'Reason and target supplied to onHide.'],
              ],
            )}
          </>
        )
      },
    },
  ],
} satisfies UiDocs
