import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Entrance and exit',
  slug: 'entrance-exit',
  category: 'animation',
  description: 'Animate elements as they enter and leave the rendered tree.',
  importPath: '@remix-run/ui/animation',
} satisfies PageMeta

const presence = await loadExample('animation/entrance-exit/presence')

export const preview = presence

const anatomyCode = await highlightSource(`
  import { animateEntrance, animateExit } from '@remix-run/ui/animation'

  {visible && (
    <div key="notification" mix={[animateEntrance(), animateExit()]}>
      Changes saved
    </div>
  )}
`)

const timingCode = await highlightSource(`
  <div mix={[
    animateEntrance({ opacity: 0, transform: 'translateY(12px)', ...spring('snappy') }),
    animateExit({ opacity: 0, transform: 'translateY(-12px)', duration: 200, easing: 'ease-in' }),
  ]}>Changes saved</div>
`)

const identityCode = await highlightSource(`
  {visible && (
    <div key="notification" mix={[animateEntrance(), animateExit()]}>
      Changes saved
    </div>
  )}
`)

const initialEntranceCode = await highlightSource(
  `
    animateEntrance({ opacity: 0, ...spring('snappy'), initial: false })
  `,
  'ts',
)

export default function EntranceExitPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="presence" example={presence} hero />
      <Section id="anatomy" title="Anatomy">
        <p>Apply entrance and exit mixins to the element being inserted or removed.</p>

        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="timing" title="Customizing motion">
        <p>
          Style values define the entrance's starting keyframe and the exit's destination. The
          element's normal styles define the other end. Spread a spring to use spring timing.
        </p>

        <CodeBlock html={timingCode} />
      </Section>
      <Section id="identity" title="Keys and interrupted animations">
        <p>
          A stable key lets an element return during its exit animation. Entrance resumes from its
          current appearance, and removal waits until exit finishes.
        </p>

        <CodeBlock html={identityCode} />
      </Section>
      <Section id="initial-entrance" title="Skipping the first entrance">
        <p>
          Set <code>initial: false</code> to skip the first entrance for a key within its parent.
          Later insertions still animate.
        </p>

        <CodeBlock html={initialEntranceCode} />
      </Section>
      <Section id="reduced-motion" title="Reduced motion">
        <p>
          Use zero-duration timing when motion is reduced. See{' '}
          <a href="/animation/reduced-motion/">Reduced motion</a> for preference checks during
          render.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="entrance-reference">animateEntrance(config?)</h3>
        <p>
          Runs when the element is inserted, from the supplied style values to its normal styles.
          Returns an element mixin.
        </p>
        <ApiTable
          label="Configuration"
          typeLabel="Value"
          entries={[
            {
              name: 'Omitted or true',
              type: <code>{'undefined | true'}</code>,
              description: <>150 ms opacity fade from zero with ease-out.</>,
            },
            {
              name: 'Options object',
              type: (
                <code>
                  {
                    '{ duration: number, easing?: string, delay?: number, composite?: CompositeOperation, initial?: boolean, [property: string]: unknown }'
                  }
                </code>
              ),
              description: (
                <>
                  Uses the supplied keyframe and timing. Requires <code>duration</code>.
                </>
              ),
            },
            {
              name: 'false or null',
              type: <code>{'false | null'}</code>,
              description: <>Disables entrance animation.</>,
            },
          ]}
        />
        <ApiTable
          label="Option"
          defaults
          entries={[
            {
              name: 'duration',
              type: <code>{'number'}</code>,
              description: <>Playback time in milliseconds.</>,
              required: true,
            },
            {
              name: 'easing',
              type: <code>{'string'}</code>,
              description: <>CSS easing function.</>,
              defaultValue: <code>{"'linear'"}</code>,
            },
            {
              name: 'delay',
              type: <code>{'number'}</code>,
              description: <>Delay before playback in milliseconds.</>,
              defaultValue: <code>{'0'}</code>,
            },
            {
              name: 'composite',
              type: <code>{'CompositeOperation'}</code>,
              description: (
                <>
                  How the keyframe combines with underlying styles. Accepts <code>'replace'</code>,{' '}
                  <code>'add'</code> or <code>'accumulate'</code>.
                </>
              ),
              defaultValue: <code>{"'replace'"}</code>,
            },
            {
              name: 'Style properties',
              type: <code>{'string | number'}</code>,
              description: (
                <>
                  Starting values for entrance or destination values for exit. Other value types are
                  ignored.
                </>
              ),
            },
          ]}
        />
        <ApiTable
          label="Entrance option"
          defaults
          entries={[
            {
              name: 'initial',
              type: <code>{'boolean'}</code>,
              description: <>False skips the first entrance for a key within its parent.</>,
              defaultValue: <code>{'true'}</code>,
            },
          ]}
        />
        <h3 id="exit-reference">animateExit(config?)</h3>
        <p>
          Runs when the element is removed, from its current styles to the supplied values. Keeps
          the element in the DOM until playback finishes. Returns an element mixin.
        </p>
        <ApiTable
          label="Configuration"
          typeLabel="Value"
          entries={[
            {
              name: 'Omitted or true',
              type: <code>{'undefined | true'}</code>,
              description: <>150 ms opacity fade to zero with ease-in.</>,
            },
            {
              name: 'Options object',
              type: (
                <code>
                  {
                    '{ duration: number, easing?: string, delay?: number, composite?: CompositeOperation, initial?: boolean, [property: string]: unknown }'
                  }
                </code>
              ),
              description: (
                <>
                  Accepts the same timing and style options as <code>animateEntrance()</code>. The
                  style values are the destination keyframe. <code>initial</code> has no effect.
                </>
              ),
            },
            {
              name: 'false or null',
              type: <code>{'false | null'}</code>,
              description: <>Removes the element without an exit animation.</>,
            },
          ]}
        />
        <p>
          Both mixins use the Web Animations API and do not automatically read reduced-motion
          preferences.
        </p>
      </Section>
    </PageLayout>
  )
}
