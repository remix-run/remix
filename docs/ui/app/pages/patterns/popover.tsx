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
          '&:popover-open': {},
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
        transition: 'opacity 140ms ease, display 140ms allow-discrete, overlay 140ms allow-discrete',
        '&:popover-open': {
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
    `export interface PopoverProps {
  children?: RemixNode
}`,
  ),
  PopoverContext: await highlightSource(
    `export interface PopoverContext {
  hideFocusTarget: HTMLElement | null
  showFocusTarget: HTMLElement | null
  surface: HTMLElement | null
  anchor: { target: AnchorTarget; options: AnchorOptions } | null
}`,
  ),
  PopoverSurfaceOptions: await highlightSource(
    `export interface PopoverSurfaceOptions {
  open: boolean
  onHide: (request?: PopoverHideRequest) => void
  closeOnAnchorClick?: boolean
  restoreFocusOnHide?: boolean
  stopOutsideClickPropagation?: boolean
}`,
  ),
  PopoverHideRequest: await highlightSource(
    `export interface PopoverHideRequest {
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
          closure for Escape from within the surface or an outside click. Update <code>open</code>{' '}
          to accept the request. Opening uses the browser’s top layer and locks page scrolling.
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
            Requests closure for Escape within the surface or an outside click. The surface stays
            open until open becomes false.
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
          <ApiEntry name="popover" type="manual">
            Controls the native top-layer surface.
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
          <ApiEntry id="type-PopoverProps" name="PopoverProps" type="interface">
            <p>Provider children.</p>
            <CodeBlock html={typeDefinitions.PopoverProps} />
          </ApiEntry>
          <ApiEntry id="type-PopoverContext" name="PopoverContext" type="interface">
            <p>Registered surface, anchor and focus targets.</p>
            <CodeBlock html={typeDefinitions.PopoverContext} />
          </ApiEntry>
          <ApiEntry id="type-PopoverSurfaceOptions" name="PopoverSurfaceOptions" type="interface">
            <p>Controlled state and dismissal options.</p>
            <CodeBlock html={typeDefinitions.PopoverSurfaceOptions} />
          </ApiEntry>
          <ApiEntry id="type-PopoverHideRequest" name="PopoverHideRequest" type="interface">
            <p>Reason and target supplied to onHide.</p>
            <CodeBlock html={typeDefinitions.PopoverHideRequest} />
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}
