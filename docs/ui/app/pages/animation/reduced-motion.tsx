import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource } from '../../data/examples.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'

export const meta = {
  title: 'Reduced motion',
  slug: 'reduced-motion',
  category: 'animation',
  description: 'Respect motion preferences in CSS and JavaScript.',
  importPath: '@remix-run/ui/animation',
} satisfies PageMeta

const cssCode = await highlightSource(`
  import { spring } from '@remix-run/ui/animation'
  import { css } from 'remix/component'

  <div mix={css({
    transform: moved ? 'translateX(200px)' : 'translateX(0)',
    transition: spring.transition('transform', 'snappy'),
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  })} />
`)

const playbackCode = await highlightSource(
  `
    import { prefersReducedMotion, spring } from '@remix-run/ui/animation'

    function reveal(element: HTMLElement) {
      element.hidden = false
      if (prefersReducedMotion()) return

      element.animate(
        [{ opacity: 0, transform: 'translateY(8px)' }, {}],
        spring('snappy'),
      )
    }
  `,
  'ts',
)

const entranceExitCode = await highlightSource(`
  import { animateEntrance, animateExit, prefersReducedMotion, spring } from '@remix-run/ui/animation'

  function Notification() {
    return () => {
      let timing = prefersReducedMotion() ? { duration: 0 } : spring('snappy')

      return (
        <div
          key="notification"
          mix={[
            animateEntrance({
              opacity: 0,
              transform: 'translateY(8px)',
              ...timing,
            }),
            animateExit({
              opacity: 0,
              transform: 'translateY(-8px)',
              ...timing,
            }),
          ]}
        >
          Changes saved
        </div>
      )
    }
  }
`)

const layoutCode = await highlightSource(`
  import { animateLayout, prefersReducedMotion, spring } from '@remix-run/ui/animation'

  <div
    mix={animateLayout(
      prefersReducedMotion()
        ? false
        : spring('smooth'),
    )}
  >
    Details
  </div>
`)

export default function ReducedMotionPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Section id="css-transitions" title="CSS transitions">
        <p>
          Use a media query to remove transitions when the user requests reduced motion. The styles
          still update to their final values, and the query responds to preference changes without a
          render or JavaScript.
        </p>
        <CodeBlock html={cssCode} />
      </Section>
      <Section id="javascript-playback" title="JavaScript playback">
        <p>
          Call <code>prefersReducedMotion()</code> before starting playback. Show the final state
          immediately when motion is reduced.
        </p>
        <CodeBlock html={playbackCode} />
        <p>
          The same check applies to custom <a href="/animation/spring/">spring</a> and{' '}
          <a href="/animation/tween/">tween</a> loops. Cancel any previous playback and apply the
          destination value when skipping animation.
        </p>
      </Section>
      <Section id="animation-mixins" title="Animation mixins">
        <p>
          The mixins do not read the preference automatically. Check it during render and use zero
          duration for entrance and exit animations.
        </p>
        <CodeBlock html={entranceExitCode} />
        <p>
          Pass <code>false</code> to <code>animateLayout()</code> so position and size changes take
          effect immediately.
        </p>
        <CodeBlock html={layoutCode} />
        <p>
          Exit animations use the configuration from the element's last render. Changing the
          preference alone does not update that configuration.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="prefers-reduced-motion-reference">prefersReducedMotion()</h3>
        <p>
          Returns whether the browser currently matches <code>prefers-reduced-motion: reduce</code>.
          Takes no arguments and returns a boolean. Returns <code>false</code> during server
          rendering or when <code>matchMedia</code> is unavailable.
        </p>
        <p>
          Each call reads the current preference. It does not subscribe to changes, trigger renders
          or stop animations already in progress.
        </p>
      </Section>
    </PageLayout>
  )
}
