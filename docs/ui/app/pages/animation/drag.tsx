import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Drag',
  slug: 'drag',
  category: 'animation',
  description: 'Dragging, momentum, elastic bounds and release snapping.',
  importPath: '@remix-run/ui/animation',
} satisfies PageMeta

const free = await loadExample('animation/drag/free')
const snapGrid = await loadExample('animation/drag/snap-grid')
const constraints = await loadExample('animation/drag/constraints')
const directionLock = await loadExample('animation/drag/direction-lock')
const vertical = await loadExample('animation/drag/vertical')
const release = await loadExample('animation/drag/resistance')
const physics = await loadExample('animation/drag/physics')
const reordering = await loadExample('animation/drag/reordering')
const panning = await loadExample('animation/drag/panning')

const anatomyCode = await highlightSource(`
  import { drag } from '@remix-run/ui/animation'

  const element = <div mix={drag()} />
`)

const elementConstraintsCode = await highlightSource(`
  import { drag } from '@remix-run/ui/animation'
  import { ref } from 'remix/component'

  function DraggableTile() {
    let container: HTMLElement | undefined

    return () => (
      <div mix={ref((node: HTMLElement) => {
        container = node
      })}>
        <div mix={drag({
          constraints: () => container,
        })} />
      </div>
    )
  }
`)

const pixelConstraintsCode = await highlightSource(`
  drag({
    constraints: { left: -100, right: 100, top: -60, bottom: 60 },
  })
`)

const momentumCode = await highlightSource(`
  drag({ momentum: false })

  drag({
    friction: 1.5,
  })
`)

const originCode = await highlightSource(`
  drag({
    snapToOrigin: true,
    stiffness: 450,
    dampingRatio: 0.6,
  })
`)

export default function DragPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout
      page={meta}
      pages={handle.props.pages}
      intro={
        <p>
          Add pointer dragging, momentum and release snapping to an element. Compose it with layout,
          entrance and exit animations, as in the{' '}
          <a href="/patterns/toast/#basic">swipe-to-dismiss toast</a>.
        </p>
      }
    >
      <Example id="free" example={free} hero fullBleed />
      <Section id="anatomy" title="Anatomy">
        <p>
          Apply the mixin to the element you want to drag. Both axes and momentum are enabled by
          default.
        </p>
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="free-position" title="Momentum">
        <p>
          Release velocity carries the element forward by default. Set <code>momentum: false</code>{' '}
          to keep the release position within the bounds. Increase <code>friction</code> to slow
          momentum faster and shorten its travel. Lower values let it glide farther. A new gesture
          interrupts settling at its current position.
        </p>
        <CodeBlock html={momentumCode} />
      </Section>
      <Section id="axes" title="Axis locking">
        <p>
          Set <code>axis</code> to <code>'x'</code> or <code>'y'</code> to restrict movement. Touch
          scrolling remains available on the other axis.
        </p>
        <Example id="vertical" example={vertical} fullBleed />
      </Section>
      <Section id="direction-lock" title="Direction locking">
        <p>
          Instead of choosing an axis in advance, set <code>directionLock: true</code> to let the
          initial movement choose it for the rest of the gesture. Style
          <code> [data-drag-axis="x"]</code> and <code>[data-drag-axis="y"]</code> to reflect the
          active axis.
        </p>
        <Example id="direction-lock-example" example={directionLock} fullBleed />
      </Section>
      <Section id="constraints" title="Constraints">
        <p>
          Use a containing element or numeric pixel bounds to limit movement. The default elasticity
          lets the element stretch past an edge before springing back inside.
        </p>
        <Example id="constraints-example" example={constraints} fullBleed />
        <h3>Element constraints</h3>
        <p>
          Capture the container with <code>ref()</code>, then pass a function returning it to
          <code> constraints</code>. The function lets the mixin read the mounted element when a
          gesture starts, rather than during rendering. It measures both elements to calculate the
          translation bounds. Smaller elements stay inside the container. Larger content pans
          between its edges.
        </p>
        <CodeBlock html={elementConstraintsCode} />
        <p>
          Give the container and draggable element their dimensions and initial layout with CSS.
          Element bounds track resizing and preserve the draggable element's relative position
          within the available space. A resolver returning <code>undefined</code> leaves movement
          unbounded.
        </p>
        <h3>Pixel constraints</h3>
        <p>
          Numeric bounds limit translation from the element's layout position. Negative values allow
          movement left or up; positive values allow movement right or down. Omitted edges remain
          unbounded. A resolver can also return this bounds object.
        </p>
        <CodeBlock html={pixelConstraintsCode} />
      </Section>
      <Section id="physics" title="Elasticity and springs">
        <p>
          Constraints define the allowed region. <code>elasticity</code> controls how far the
          element follows the pointer beyond an edge. Set it to 0 for a hard edge or 1 to follow the
          pointer fully. Values between them allow partial movement. Set individual edges with an
          object such as <code>{'{ left: 0, right: 0.2 }'}</code>.
        </p>
        <p>
          After release, <code>stiffness</code> controls how strongly the spring pulls back inside
          the bounds. <code>dampingRatio</code> controls how much it oscillates while returning.
          Values below 1 allow bounce. At 1 the spring is critically damped, and values above 1
          produce a more gradual, overdamped return. Zero elasticity prevents boundary overshoot
          during release too.
        </p>
        <Example id="physics-example" example={physics} fullBleed />
      </Section>
      <Section id="release" title="Snapping to origin">
        <p>
          Set <code>snapToOrigin: true</code> to spring back after release. This chooses a release
          destination without restricting where you can drag. Constraints instead bound movement
          throughout the gesture. For example, a card can resist leftward movement with{' '}
          <code>{'constraints: { left: 0 }'}</code>, move freely rightward, then return with{' '}
          <code>snapToOrigin</code>. Setting both horizontal constraints to 0 would resist movement
          in both directions. The origin is offset 0, clamped to the bounds.
        </p>
        <CodeBlock html={originCode} />
      </Section>
      <Section id="snap-list" title="Snapping with modifyTarget">
        <p>
          Use <code>modifyTarget</code> to adjust the projected release destination for each axis.
          Rounding the target to a fixed interval creates snapping while preserving momentum.
        </p>
        <Example id="snap-list-example" example={snapGrid} fullBleed />
      </Section>
      <Section id="resistance" title="Drag events">
        <p>
          Compose <code>onDragStart</code>, <code>onDrag</code> and <code>onDragEnd</code> to
          respond to a gesture. Their bubbling events carry pointer position, movement, displacement
          and velocity directly on the event, with the original input available as{' '}
          <code>sourceEvent</code>.
        </p>
        <p>
          Use <code>onDragEnd</code> to decide what happens after a gesture. Returning normally lets
          momentum, constraints and snapping settle the element. Call <code>preventDefault()</code>
          on a normal release to retain its current position and take over, such as with an exit
          animation.
        </p>
        <p>
          Track movement across events when release behaviour depends on the gesture's trajectory,
          such as reversing direction before release.
        </p>
        <Example id="resistance-example" example={release} fullBleed />
      </Section>
      <Section id="panning" title="Panning">
        <p>
          Constrain larger content to a smaller viewport to pan a diagram or canvas. The same
          element constraints bound movement at each edge.
        </p>
        <Example id="panning-example" example={panning} fullBleed />
      </Section>
      <Section id="reordering" title="Drag with layout animation">
        <p>
          Compose <code>drag()</code> and <code>animateLayout()</code> on the same element to
          combine pointer movement with animated layout changes. The mixins coordinate their
          transforms, so layout changes can animate during a drag without interrupting the gesture.
        </p>
        <p>Apply custom CSS transforms to a separate wrapper or child element.</p>
        <Example id="reordering-example" example={reordering} fullBleed />
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="drag-reference">drag(options?)</h3>
        <ApiTable id="drag-options" label="Option" defaults>
          <ApiEntry name="axis" type="'x' | 'y'" defaultValue="Both axes">
            Restricts movement to one axis and leaves touch scrolling available on the other.
          </ApiEntry>
          <ApiEntry name="directionLock" type="boolean" defaultValue="false">
            Locks to the initial direction. Emits data-drag-axis while dragging.
          </ApiEntry>
          <ApiEntry
            name="constraints"
            type="{ left?: number; right?: number; top?: number; bottom?: number } | (() => HTMLElement | { left?: number; right?: number; top?: number; bottom?: number } | undefined)"
            defaultValue="Unbounded"
          >
            Translation bounds in local pixels, or a function returning an HTMLElement, a bounds
            object or undefined. An element supplies bounds that keep the draggable inside its
            container, or pan larger content between its edges. Element bounds track resizing.
            Omitted edges or an undefined result leave movement unbounded.
          </ApiEntry>
          <ApiEntry
            name="elasticity"
            type="number | { left?: number; right?: number; top?: number; bottom?: number }"
            defaultValue="0.2"
          >
            Linear overshoot factor from 0 to 1, optionally per edge. Zero prevents overshoot during
            dragging and release, including momentum and spring-driven snapping.
          </ApiEntry>
          <ApiEntry name="momentum" type="boolean" defaultValue="true">
            Carries pointer velocity into release. Disable to retain the release position within
            bounds.
          </ApiEntry>
          <ApiEntry name="snapToOrigin" type="boolean" defaultValue="false">
            Springs to the origin on release or cancellation. Without this option, cancellation
            stops momentum and keeps the current position within the bounds.
          </ApiEntry>
          <ApiEntry name="stiffness" type="number" defaultValue="158">
            Stiffness of the spring that returns the element to the origin or within constraints.
          </ApiEntry>
          <ApiEntry name="dampingRatio" type="number" defaultValue="1">
            Damping ratio of the return spring. Values below 1 allow oscillation, 1 is critical
            damping, and values above 1 are overdamped. Zero removes damping. Must be nonnegative.
          </ApiEntry>
          <ApiEntry name="friction" type="number" defaultValue="2">
            Exponential momentum decay rate per second. At 2, velocity falls to about 14% after one
            second. Higher values slow movement faster and shorten its travel. Must be finite and
            positive. Invalid values use the default.
          </ApiEntry>
          <ApiEntry name="modifyTarget" type="(target: number, axis: 'x' | 'y') => number">
            Adjusts the projected release destination in local pixels before constraints apply.
          </ApiEntry>
        </ApiTable>
        <h3 id="drag-attributes">Drag attributes</h3>
        <ApiTable id="drag-state" label="Attribute">
          <ApiEntry name="data-dragging" type="''">
            Present while a drag gesture is active. Use [data-dragging] for active styling.
          </ApiEntry>
          <ApiEntry name="data-drag-axis" type="'x' | 'y'">
            Present during dragging when an axis is configured or chosen by direction locking.
            Absent when both axes are active. Use [data-drag-axis="x"] or [data-drag-axis="y"] for
            axis-specific styling.
          </ApiEntry>
          <ApiEntry name="data-drag-ignore" type="Attribute on a descendant">
            Prevents pointer-down on that descendant from starting a drag. Buttons, links, inputs,
            textareas, selects and editable content are already excluded.
          </ApiEntry>
        </ApiTable>
        <h3 id="drag-listeners">Event listeners</h3>
        <p>
          Compose <code>onDragStart(handler)</code>, <code>onDrag(handler)</code> and
          <code> onDragEnd(handler)</code> with <code>drag()</code>. Their handlers receive a
          DragStartEvent, DragEvent or DragEndEvent and an AbortSignal. The signal aborts when that
          listener runs again or is removed. An optional second argument enables capture, like the
          other event listener mixins.
        </p>
        <p>
          These are bubbling DOM events named <code>rmx:drag-start</code>, <code>rmx:drag</code> and
          <code> rmx:drag-end</code>. Listen on the draggable element, an ancestor or with
          <code> document.addEventListener()</code>. Use <code>event.target</code> to identify the
          draggable element. These events are separate from native HTML drag-and-drop events.
          Dragging alone does not supply keyboard semantics; provide native alternatives for
          dismissal or reordering.
        </p>
        <h3 id="release-event">Event data</h3>
        <p>
          Start and move events are notifications. The end event fires after pointer tracking ends
          and before settling starts. All three carry independent snapshots of these measurements,
          including both axes regardless of locking, constraints or elasticity.
        </p>
        <ApiTable id="drag-release-event" label="Member">
          <ApiEntry name="point" type="{ x: number; y: number }">
            Pointer position in client pixels. Cancellation retains the last pointer position.
          </ApiEntry>
          <ApiEntry name="delta" type="{ x: number; y: number }">
            Pointer movement since the previous sample, in client pixels.
          </ApiEntry>
          <ApiEntry name="offset" type="{ x: number; y: number }">
            Pointer displacement since pointer-down, in client pixels. Independent of the element's
            starting translation, layout movement, constraints and elasticity.
          </ApiEntry>
          <ApiEntry name="velocity" type="{ x: number; y: number }">
            Pointer velocity in client pixels per second. Positive values move right or down.
            Becomes zero after the pointer has been still for more than 100ms.
          </ApiEntry>
          <ApiEntry name="axis" type="'x' | 'y' | undefined">
            The configured or direction-locked axis. Undefined when both axes are active.
          </ApiEntry>
          <ApiEntry name="sourceEvent" type="Event | undefined">
            The original pointermove for start and move events. On end events, this is the
            pointerup, pointercancel, Escape or window blur event. Undefined when the element exits
            or its mixin is removed. Narrow with instanceof PointerEvent or KeyboardEvent when
            inspecting input-specific details. Preventing the end event does not prevent the source
            event, or vice versa.
          </ApiEntry>
          <ApiEntry name="cancelled" type="boolean">
            Available on DragEndEvent. True when the gesture ends without a normal pointer release,
            such as Escape or pointer cancellation. Normal cancellation stops momentum and settles
            within constraints, respecting snapToOrigin.
          </ApiEntry>
          <ApiEntry name="preventDefault()" type="() => void">
            Skips settling on a normal DragEndEvent and retains the current visual position. The
            decision must be synchronous; awaiting work does not delay settling. Cancellation events
            are not cancelable. Lifecycle-driven cancellation hands control to exit or cleanup
            instead of starting another settling animation.
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}
