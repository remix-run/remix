import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/page.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../../actions/docs/example.tsx'
import { CodeBlock, PageLayout, Section } from '../../actions/docs/page.tsx'
import { referenceTable } from '../../ui/reference-table.tsx'

export const meta = {
  title: 'Popover',
  slug: 'popover',
  category: 'primitives',
  description: 'Anchored floating panels with dismissal and focus restoration.',
  importPath: '@remix-run/ui/popover',
} satisfies PageMeta

const basic = await loadExample(
  new URL('../../../../../packages/ui/src/popover/basic.example.tsx', import.meta.url),
)

const editableAnchorExample = await loadExample(
  new URL('../../../../../packages/ui/src/popover/editable-anchor.example.tsx', import.meta.url),
)

const anatomyCode = await highlightSource(`import * as popover from '@remix-run/ui/popover'

<popover.Context>
  <button
    type="button"
    mix={[
      popover.anchor({ placement: 'bottom-start', offset: 8 }),
      popover.focusOnHide(),
      on('click', () => { open = true
        handle.update() }),
    ]}
  >Filters</button>
  <div mix={popover.surface({
    open,
    onHide() { open = false
      handle.update() },
  })}>
    <input aria-label="Filter projects" mix={popover.focusOnShow()} />
  </div>
</popover.Context>`)

const stateCode = await highlightSource(`popover.surface({
  open,
  onHide(request) {
    open = false
    handle.update()
  },
})`)

const positionCode = await highlightSource(`popover.anchor({ placement: 'bottom-end', offset: 8 })`)

const focusCode = await highlightSource(`<button mix={popover.focusOnHide()}>Open filters</button>

<div mix={popover.surface({ open, onHide, restoreFocusOnHide: false })}>
  <input aria-label="Filter projects" mix={popover.focusOnShow()} />
</div>`)

const motionCode = await highlightSource(`<div mix={[
  css({
    opacity: 0,
    transition: 'opacity 140ms ease, display 140ms allow-discrete, overlay 140ms allow-discrete',
    '&:popover-open': { opacity: 1, '@starting-style': { opacity: 0 } },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  }),
  popover.surface({ open, onHide }),
]} />`)

const accessibilityCode =
  await highlightSource(`<button aria-expanded={open} aria-controls="project-filters">Filters</button>
<div id="project-filters" role="dialog" aria-label="Project filters" mix={popover.surface({ open, onHide })} />`)

export default function PopoverPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero compact />
      <Section id="anatomy" title="Anatomy">
        <p>Wrap the anchor, surface and focus targets in the same provider.</p>
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="state" title="Opening and dismissal">
        <p>
          <code>surface()</code> requires an <code>open</code> boolean. <code>onHide</code> requests
          closure for Escape or an outside click. Update <code>open</code> to accept the request.
          Opening uses the browser’s top layer and locks page scrolling.
        </p>
        <CodeBlock html={stateCode} />
      </Section>
      <Section id="position" title="Positioning">
        <p>
          <code>anchor()</code> accepts placement, offsets, inset and relative alignment from the
          Anchor API. The surface tracks geometry changes and flips when needed to fit the viewport.
        </p>
        <CodeBlock html={positionCode} />
      </Section>
      <Section id="anchor-interaction" title="Interactive anchors">
        <p>
          Set <code>closeOnAnchorClick</code> to false when the anchor must remain interactive while
          the surface is open. This is useful for inputs that update a floating preview.
        </p>
        <Example id="editable-anchor-example" example={editableAnchorExample} compact />
      </Section>
      <Section id="focus" title="Focus targets">
        <p>
          <code>focusOnShow()</code> registers the initial focus target. <code>focusOnHide()</code>{' '}
          registers the return target. Targets must be focusable. Set{' '}
          <code>restoreFocusOnHide</code> to false when closure should leave focus where the user
          moved it.
        </p>
        <CodeBlock html={focusCode} />
      </Section>
      <Section id="motion" title="Transitions">
        <p>
          Native popover transitions can use <code>:popover-open</code>,{' '}
          <code>@starting-style</code> and discrete transitions for <code>display</code> and{' '}
          <code>overlay</code>. Keeping the surface in the top layer through exit lets opacity
          finish animating.
        </p>
        <CodeBlock html={motionCode} />
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          The surface does not add a role, accessible name or focus trap. Choose semantics for its
          content. Use an accessible name for dialog-like panels and add <code>aria-expanded</code>{' '}
          and <code>aria-controls</code> to their triggers. Keep a keyboard path to dismissal.
        </p>
        <CodeBlock html={accessibilityCode} />
      </Section>
      <Section id="api-reference" title="API reference">
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
            ['showFocusTarget, hideFocusTarget', 'HTMLElement | null', 'Registered focus targets.'],
          ],
        )}
        <h3 id="anchor-reference">anchor(options)</h3>
        <p>
          Registers its host as the anchor. Requires an options object, which may be empty. Accepts
          all <code>AnchorOptions</code>. Does not decorate the element with trigger semantics.
        </p>
        <h3 id="surface-reference">surface(options)</h3>
        {referenceTable(
          ['Option', 'Type', 'Behavior'],
          [
            ['open', 'boolean', 'Required controlled open state.'],
            ['onHide', '(request?: PopoverHideRequest) => void', 'Required dismissal callback.'],
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
      </Section>
    </PageLayout>
  )
}
