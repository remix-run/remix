import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Tween',
  slug: 'tween',
  category: 'animation',
  description: 'Interpolate numeric values over time with a cubic Bézier easing curve.',
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

const typeDefinitions = {
  TweenOptions: await highlightSource(
    `export interface TweenOptions {
  from: number
  to: number
  duration: number
  curve: BezierCurve
}`,
  ),
  BezierCurve: await highlightSource(
    `export interface BezierCurve {
  x1: number
  y1: number
  x2: number
  y2: number
}`,
  ),
}

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
        <p>
          Apply the destination immediately when motion is reduced. See{' '}
          <a href="/animation/reduced-motion/">Reduced motion</a>.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="tween-reference">tween(options)</h3>
        <p>
          Returns <code>Generator&lt;number, number, number&gt;</code>. The first{' '}
          <code>next()</code> yields <code>from</code>. The first supplied timestamp establishes the
          start time. Subsequent timestamps use the same clock and are measured in milliseconds.
          Completion returns <code>to</code> with <code>done: true</code>.
        </p>
        <ApiTable
          label="Option"
          entries={[
            {
              name: 'from',
              type: <code>{'number'}</code>,
              description: <>Starting value.</>,
              required: true,
            },
            {
              name: 'to',
              type: <code>{'number'}</code>,
              description: <>Destination value.</>,
              required: true,
            },
            {
              name: 'duration',
              type: <code>{'number'}</code>,
              description: <>Playback time in milliseconds.</>,
              required: true,
            },
            {
              name: 'curve',
              type: <code>{'BezierCurve'}</code>,
              description: <>Cubic Bézier control points.</>,
              required: true,
            },
          ]}
        />
        <h3 id="easings-reference">easings</h3>
        <p>Built-in curves matching the corresponding CSS easing functions.</p>
        <ApiTable
          label="Name"
          typeLabel="Control points"
          entries={[
            {
              name: 'linear',
              type: <code>{'0, 0, 1, 1'}</code>,
              description: (
                <>
                  Control points in <code>x1, y1, x2, y2</code> order.
                </>
              ),
            },
            {
              name: 'ease',
              type: <code>{'0.25, 0.1, 0.25, 1'}</code>,
              description: (
                <>
                  Control points in <code>x1, y1, x2, y2</code> order.
                </>
              ),
            },
            {
              name: 'easeIn',
              type: <code>{'0.42, 0, 1, 1'}</code>,
              description: (
                <>
                  Control points in <code>x1, y1, x2, y2</code> order.
                </>
              ),
            },
            {
              name: 'easeOut',
              type: <code>{'0, 0, 0.58, 1'}</code>,
              description: (
                <>
                  Control points in <code>x1, y1, x2, y2</code> order.
                </>
              ),
            },
            {
              name: 'easeInOut',
              type: <code>{'0.42, 0, 0.58, 1'}</code>,
              description: (
                <>
                  Control points in <code>x1, y1, x2, y2</code> order.
                </>
              ),
            },
          ]}
        />
        <h3 id="curve-reference">BezierCurve</h3>
        <ApiTable
          label="Property"
          entries={[
            {
              name: 'x1, y1',
              type: <code>{'number'}</code>,
              description: <>First control point.</>,
            },
            {
              name: 'x2, y2',
              type: <code>{'number'}</code>,
              description: <>Second control point.</>,
            },
          ]}
        />
        <h3 id="types-reference">Exported types</h3>
        <ApiTable
          detailsLabel="Definition"
          entries={[
            {
              name: 'TweenOptions',
              type: <code>{'interface'}</code>,
              description: (
                <>
                  Options accepted by <code>tween()</code>.
                </>
              ),
              id: 'type-TweenOptions',
              details: <CodeBlock html={typeDefinitions.TweenOptions} />,
            },
            {
              name: 'BezierCurve',
              type: <code>{'interface'}</code>,
              description: (
                <>
                  Control points accepted by <code>curve</code> and used by <code>easings</code>.
                </>
              ),
              id: 'type-BezierCurve',
              details: <CodeBlock html={typeDefinitions.BezierCurve} />,
            },
          ]}
        />
      </Section>
    </PageLayout>
  )
}
