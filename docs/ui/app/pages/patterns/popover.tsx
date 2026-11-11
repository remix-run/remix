import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Popover',
  slug: 'popover',
  category: 'patterns',
  description: 'Anchored floating panels with dismissal and focus restoration.',
  importPath: '@remix-run/ui/popover',
} satisfies PageMeta

const basic = await loadExample('popover/basic')

const anatomyCode = await highlightSource(`
  import * as popover from '@remix-run/ui/popover'
  import { css, on } from 'remix/component'

  <popover.Context>
    <button
      type="button"
      aria-expanded={open}
      aria-controls="popover-content"
      mix={[
        popover.anchor({
          placement: 'bottom-start',
          offset: 8,
        }),
        popover.focusOnHide(),
        on('click', show),
        css({
          '&[aria-expanded="true"]': {},
          '&[aria-expanded="false"]': {},
          '&:focus-visible': {},
          '&:disabled': {},
        }),
      ]}
    >
      Trigger text
    </button>
    <div
      id="popover-content"
      role="dialog"
      aria-label="Popover label"
      tabIndex={-1}
      mix={[
        popover.surface({
          open,
          onHide: hide,
        }),
        popover.focusOnShow(),
        css({
          '&[data-open]': {},
          '&[data-state="open"]': {},
          '&[data-state="closed"]': {},
          '&:focus-visible': {},
        }),
      ]}
    >
      Popover content
    </div>
  </popover.Context>
`)

const stateCode = await highlightSource(`
  popover.surface({
    open,
    onHide(request) {
      open = false
      handle.update()
    },
  })
`)

const positionCode = await highlightSource(`
  popover.anchor({ placement: 'bottom-end', offset: 8 })
`)

const anchorInteractionCode = await highlightSource(`
  popover.surface({ open, onHide, closeOnAnchorClick: false })
`)

const portalCode = await highlightSource(`
  import { Portal } from '@remix-run/ui/portal'
  import * as popover from '@remix-run/ui/popover'

  <popover.Context>
    <button mix={popover.anchor({ placement: 'bottom-start' })}>Filters</button>
    <Portal>
      <div mix={popover.surface({ open, onHide })}>
        Filter controls
      </div>
    </Portal>
  </popover.Context>
`)

const focusCode = await highlightSource(`
  <>
    <button mix={popover.focusOnHide()}>Open filters</button>
    <div
      mix={popover.surface({
        open,
        onHide,
        restoreFocusOnHide: false,
      })}
    >
      <input aria-label="Filter files" mix={popover.focusOnShow()} />
    </div>
  </>
`)

const motionCode = await highlightSource(`
  <div
    mix={[
      popover.surface({
        open,
        onHide,
      }),
      css({
        opacity: 0,
        transition: 'opacity 140ms ease',
        '&[data-state="open"]': {
          opacity: 1,
          '@starting-style': {
            opacity: 0,
          },
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
        },
      }),
    ]}
  />
`)

const accessibilityCode = await highlightSource(`
  <>
    <button aria-expanded={open} aria-controls="file-filters">
      Filters
    </button>
    <div
      id="file-filters"
      role="dialog"
      aria-label="File filters"
      mix={popover.surface({
        open,
        onHide,
      })}
    />
  </>
`)

const typeDefinitions = {
  PopoverProps: await highlightSource(
    `export type PopoverProps = {
  children?: RemixNode
}`,
  ),
  PopoverContext: await highlightSource(
    `export type PopoverContext = {
  hideFocusTarget: HTMLElement | null
  showFocusTarget: HTMLElement | null
  surface: HTMLElement | null
  anchor: { source?: HTMLElement; target: AnchorTarget; options: AnchorOptions } | null
}`,
  ),
  PopoverSurfaceOptions: await highlightSource(
    `export type PopoverSurfaceOptions = {
  open: boolean
  onHide: (request?: PopoverHideRequest) => void
  closeOnAnchorClick?: boolean
  restoreFocusOnHide?: boolean
  stopOutsideClickPropagation?: boolean
}`,
  ),
  PopoverHideRequest: await highlightSource(
    `export type PopoverHideRequest = {
  reason: 'escape-key' | 'outside-click'
  target?: Node | null
}`,
  ),
}

export default function PopoverPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="state" title="Opening and dismissal">
        <p>
          <code>surface()</code> requires an <code>open</code> boolean. <code>onHide</code> requests
          closure for Escape or an outside click. Update <code>open</code> to accept the request.
          Opening shows an ordinary DOM surface and locks page scrolling. Escape closes the topmost
          Remix popup or dialog first.
        </p>
        <p>
          The click that follows a press that started before the surface opened, or inside it, never
          dismisses it. Triggers can add <code>press()</code> to open on mouse press: when the
          surface has a <code>focusOnShow()</code> target, <code>anchor()</code> keeps the press
          from taking focus back.
        </p>
        <CodeBlock html={stateCode} />
        <h3 id="anchor-interaction">Interactive anchors</h3>
        <p>
          Set <code>closeOnAnchorClick</code> to false to keep the surface open when its anchor is
          clicked.
        </p>
        <CodeBlock html={anchorInteractionCode} />
      </Section>
      <Section id="position" title="Positioning">
        <p>
          <code>anchor()</code> accepts placement, offsets, inset and relative alignment from the
          Anchor API. The surface tracks geometry changes and flips when needed to fit the viewport.
        </p>
        <CodeBlock html={positionCode} />
        <h3 id="portals">Portals and stacking</h3>
        <p>
          Wrap the surface in <code>Portal</code> to render it under the document body and escape
          clipping, transforms and stacking contexts on its authored ancestors. An optional{' '}
          <code>container</code> selects another element in the same document. Component context,
          frame and child state are preserved. DOM events and inherited styles follow the
          destination, so apply local theme variables and typography to the surface too.
        </p>
        <CodeBlock html={portalCode} />
        <p>
          Inline surfaces are supported where ancestors do not constrain them. Remix overlays share
          visual stacking and dismissal order. Set <code>--rmx-layer-base</code> on a common
          ancestor such as the document root to offset their z-index as a group. Ordinary
          third-party overlays can appear above them with z-index, but do not automatically join a
          dialog's focus or dismissal coordination.
        </p>
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
          Use <code>data-state="open"</code> and <code>data-state="closed"</code> for motion, with{' '}
          <code>@starting-style</code> for entrance transitions. The surface retains{' '}
          <code>data-open</code> and its layer while finite exit animations finish. Respect
          reduced-motion preferences.
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
        <ApiTable id="context-state" label="Provided member">
          <ApiEntry name="anchor" type="{ target: AnchorTarget, options: AnchorOptions } | null">
            Registered positioning target.
          </ApiEntry>
          <ApiEntry name="surface" type="HTMLElement | null">
            Registered floating root.
          </ApiEntry>
          <ApiEntry name="showFocusTarget, hideFocusTarget" type="HTMLElement | null">
            Registered focus targets.
          </ApiEntry>
        </ApiTable>
        <h3 id="anchor-reference">anchor(options)</h3>
        <p>
          Registers its host as the anchor. Requires an options object, which may be empty. Accepts
          all <code>AnchorOptions</code>. Does not decorate the element with trigger semantics.
        </p>
        <h3 id="surface-reference">surface(options)</h3>
        <ApiTable id="surface-options" label="Option" defaults>
          <ApiEntry name="open" type="boolean" required>
            Controlled open state.
          </ApiEntry>
          <ApiEntry name="onHide" type="(request?: PopoverHideRequest) => void" required>
            Requests closure for Escape or an outside click. The surface stays open until open
            becomes false.
          </ApiEntry>
          <ApiEntry name="closeOnAnchorClick" type="boolean" defaultValue="true">
            False excludes anchor clicks from outside dismissal.
          </ApiEntry>
          <ApiEntry name="restoreFocusOnHide" type="boolean" defaultValue="true">
            Returns focus to the registered hide target.
          </ApiEntry>
          <ApiEntry name="stopOutsideClickPropagation" type="boolean" defaultValue="true">
            Stops outside clicks in the capture phase so they do not reach the clicked element’s
            handlers. Does not prevent the browser’s default action.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="surface-attributes" label="Attribute" typeLabel="Value">
          <ApiEntry name="data-popover" type="present">
            Identifies the popup surface.
          </ApiEntry>
          <ApiEntry name="data-open" type="present | absent">
            Present while the surface is shown.
          </ApiEntry>
          <ApiEntry name="data-state" type="open | closed">
            Requested open state.
          </ApiEntry>
        </ApiTable>
        <h3 id="focus-on-show-reference">focusOnShow()</h3>
        <p>Registers its host as the focus target when the surface opens.</p>
        <h3 id="focus-on-hide-reference">focusOnHide()</h3>
        <p>Registers its host as the focus target when the surface closes.</p>
        <h3 id="hide-request-reference">PopoverHideRequest</h3>
        <ApiTable id="hide-request-properties" label="Property">
          <ApiEntry name="reason" type="'escape-key' | 'outside-click'">
            Dismissal trigger.
          </ApiEntry>
          <ApiEntry name="target" type="Node | null | undefined">
            Outside-click target. Absent for Escape.
          </ApiEntry>
        </ApiTable>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="types-types">
          <ApiEntry id="type-PopoverProps" name="PopoverProps" type="type">
            <p>Provider children.</p>
            <CodeBlock html={typeDefinitions.PopoverProps} />
          </ApiEntry>
          <ApiEntry id="type-PopoverContext" name="PopoverContext" type="type">
            <p>Registered surface, anchor and focus targets.</p>
            <CodeBlock html={typeDefinitions.PopoverContext} />
          </ApiEntry>
          <ApiEntry id="type-PopoverSurfaceOptions" name="PopoverSurfaceOptions" type="type">
            <p>Controlled state and dismissal options.</p>
            <CodeBlock html={typeDefinitions.PopoverSurfaceOptions} />
          </ApiEntry>
          <ApiEntry id="type-PopoverHideRequest" name="PopoverHideRequest" type="type">
            <p>Reason and target supplied to onHide.</p>
            <CodeBlock html={typeDefinitions.PopoverHideRequest} />
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}
