import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/page.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'

export const meta = {
  title: 'Tween',
  slug: 'tween',
  category: 'animation',
  description: 'Interpolate numeric values over time with a cubic B\u00e9zier easing curve.',
  importPath: '@remix-run/ui/animation',
} satisfies PageMeta

const timing = await loadExample('animation/tween/timing')

const anatomyCode = await highlightSource(
  `
    import { easings, tween } from '@remix-run/ui/animation'

    let animation = tween({ from: 0, to: 200, duration: 600, curve: easings.easeOut })
    animation.next()
    let next = animation.next(timestamp)
  `,
  'ts',
)

const framesCode = await highlightSource(`
  let animation = tween({ from: position, to: target, duration: 600, curve: easings.easeOut })
  animation.next()
  let frame = requestAnimationFrame(tick)

  function tick(timestamp: number) {
    let next = animation.next(timestamp)
    position = next.value
    handle.update()
    if (!next.done) frame = requestAnimationFrame(tick)
  }

  <div mix={css({ transform: \`translateX(\${position}px)\` })} />
`)

const curvesCode = await highlightSource(
  `
    tween({
      from: 0,
      to: 1,
      duration: 400,
      curve: { x1: 0.2, y1: 0, x2: 0.3, y2: 1.4 },
    })
  `,
  'ts',
)

const retargetingCode = await highlightSource(
  `
    cancelAnimationFrame(frame)
    let animation = tween({ from: position, to: target, duration: 600, curve: easings.easeOut })
    animation.next()
    frame = requestAnimationFrame(tick)
  `,
  'ts',
)

const reducedMotionCode = await highlightSource(
  `
    cancelAnimationFrame(frame)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      position = target
      handle.update()
    } else {
      animation = tween({ from: position, to: target, duration: 600, curve: easings.easeOut })
      animation.next()
      frame = requestAnimationFrame(tick)
    }
  `,
  'ts',
)

export default function TweenPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="timing" example={timing} hero compact />
      <Section id="anatomy" title="Anatomy">
        <p>Create a generator, prime it, then supply timestamps to advance playback.</p>

        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="frames" title="Scheduling animation frames">
        <p>
          Pass <code>requestAnimationFrame</code> timestamps to <code>next()</code>. Apply each
          returned value, including the final value when <code>done</code> is true.
        </p>

        <CodeBlock html={framesCode} />
      </Section>
      <Section id="curves" title="Custom easing">
        <p>
          A cubic Bézier curve controls the rate of change. Y control points outside zero to one
          allow overshoot.
        </p>

        <CodeBlock html={curvesCode} />
      </Section>
      <Section id="retargeting" title="Interruption">
        <p>
          Cancel the previous frame and start a new tween from the last applied value. Cancel
          outstanding frames when the component is removed.
        </p>

        <CodeBlock html={retargetingCode} />
      </Section>
      <Section id="reduced-motion" title="Reduced motion">
        <p>Skip playback and apply the destination immediately when motion is reduced.</p>

        <CodeBlock html={reducedMotionCode} />
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="tween-reference">tween(options)</h3>
        <p>
          Returns <code>Generator&lt;number, number, number&gt;</code>. The first{' '}
          <code>next()</code> yields <code>from</code>. The first supplied timestamp establishes the
          start time. Subsequent timestamps use the same clock and are measured in milliseconds.
          Completion returns <code>to</code> with <code>done: true</code>.
        </p>
        <table>
          <thead>
            <tr>
              <th>Option</th>
              <th>Type</th>
              <th>Behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>from</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>Required. Starting value.</td>
            </tr>
            <tr>
              <td>
                <code>to</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>Required. Destination value.</td>
            </tr>
            <tr>
              <td>
                <code>duration</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>Required. Playback time in milliseconds.</td>
            </tr>
            <tr>
              <td>
                <code>curve</code>
              </td>
              <td>
                <code>BezierCurve</code>
              </td>
              <td>Required. Cubic Bézier control points.</td>
            </tr>
          </tbody>
        </table>
        <h3 id="easings-reference">easings</h3>
        <p>Built-in curves matching the corresponding CSS easing functions.</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Control points</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>linear</code>
              </td>
              <td>0, 0, 1, 1</td>
            </tr>
            <tr>
              <td>
                <code>ease</code>
              </td>
              <td>0.25, 0.1, 0.25, 1</td>
            </tr>
            <tr>
              <td>
                <code>easeIn</code>
              </td>
              <td>0.42, 0, 1, 1</td>
            </tr>
            <tr>
              <td>
                <code>easeOut</code>
              </td>
              <td>0, 0, 0.58, 1</td>
            </tr>
            <tr>
              <td>
                <code>easeInOut</code>
              </td>
              <td>0.42, 0, 0.58, 1</td>
            </tr>
          </tbody>
        </table>
        <h3 id="curve-reference">BezierCurve</h3>
        <table>
          <thead>
            <tr>
              <th>Property</th>
              <th>Type</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>x1</code>, <code>y1</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>First control point.</td>
            </tr>
            <tr>
              <td>
                <code>x2</code>, <code>y2</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>Second control point.</td>
            </tr>
          </tbody>
        </table>
        <h3 id="types-reference">Exported types</h3>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>TweenOptions</code>
              </td>
              <td>
                Options accepted by <code>tween()</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>BezierCurve</code>
              </td>
              <td>
                Control points accepted by <code>curve</code> and used by <code>easings</code>.
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
    </PageLayout>
  )
}
