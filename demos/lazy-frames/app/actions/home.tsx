import { Frame, css, type Handle } from 'remix/ui'

import { exhibits, motionArtifact, type Exhibit } from '../data/exhibits.ts'
import type { DemoLatency } from '../middleware/demo-latency.ts'
import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import { LazyFrame } from '../ui/public/lazy-frame.tsx'
import type { Theme } from '../ui/public/theme.ts'
import { ThemeToggle } from '../ui/public/theme-toggle.tsx'

export function HomePage(handle: Handle<{ latency: DemoLatency; theme: Theme }>) {
  return () => (
    <Document title="Lazy-loaded Frames" theme={handle.props.theme}>
      <div mix={demoControlsStyle}>
        <ThemeToggle theme={handle.props.theme} />
        <LatencyToggle latency={handle.props.latency} />
      </div>
      <header mix={heroStyle}>
        <div mix={heroInnerStyle}>
          <h1 mix={heroHeadingStyle}>
            Load Frames as
            <br />
            they approach.
          </h1>
          <p mix={heroCopyStyle}>
            This demo’s <code>LazyFrame</code> renders a placeholder with the page, then mounts a
            Remix <code>Frame</code> within 320 pixels of the viewport. Loaded Frames stay mounted.
          </p>

          <ol mix={flowStyle} aria-label="Lazy frame lifecycle">
            <li mix={flowItemStyle}>
              <span mix={flowNumberStyle}>1</span>
              <span>The initial document contains the placeholder.</span>
            </li>
            <li mix={flowItemStyle}>
              <span mix={flowNumberStyle}>2</span>
              <span>An observer detects the host 320 pixels from the viewport.</span>
            </li>
            <li mix={flowItemStyle}>
              <span mix={flowNumberStyle}>3</span>
              <span>The Frame requests its route once and remains mounted.</span>
            </li>
          </ol>

          <a href="#delivery-comparison" mix={scrollCueStyle}>
            Compare delivery <span aria-hidden="true">↓</span>
          </a>
        </div>
      </header>

      <main mix={mainStyle}>
        <DeliveryComparison />

        <section mix={introStyle} aria-labelledby="response-shapes-heading">
          <h2 id="response-shapes-heading" mix={introHeadingStyle}>
            LazyFrame works with every response type
          </h2>
          <p mix={introCopyStyle}>
            The examples alternate between checked-in HTML, server-rendered Remix UI, and Remix UI
            with a client component. The loading behavior does not change.
          </p>
        </section>

        {exhibits.map((exhibit, index) => (
          <ExhibitSection key={exhibit.id} exhibit={exhibit} index={index} />
        ))}
      </main>

      <footer mix={footerStyle}>
        <h2 mix={footerHeadingStyle}>
          Ten Frames loaded near the viewport. The first shipped with the document.
        </h2>
        <a href="#top" mix={footerLinkStyle}>
          Return to the beginning
        </a>
      </footer>
    </Document>
  )
}

function LatencyToggle(handle: Handle<{ latency: DemoLatency }>) {
  return () => {
    let { enabled, duration } = handle.props.latency

    return (
      <form action={routes.latency.href()} method="post" mix={latencyToggleStyle}>
        <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
        <div mix={latencyStatusStyle}>
          <span
            aria-hidden="true"
            mix={[latencyDotStyle, enabled ? latencyDotEnabledStyle : latencyDotDisabledStyle]}
          />
          <span>
            <strong mix={latencyLabelStyle}>Global latency {enabled ? 'on' : 'off'}</strong>
            <small mix={latencyDetailStyle}>
              {enabled ? `${duration} ms on every request` : 'Responses run at full speed'}
            </small>
          </span>
        </div>
        <button type="submit" aria-pressed={enabled} mix={latencyButtonStyle}>
          {enabled ? 'Disable' : 'Enable'}
        </button>
      </form>
    )
  }
}

function DeliveryComparison() {
  return () => {
    let frameHref = routes.frames.html.href({ id: motionArtifact.id })

    return (
      <section id="delivery-comparison" mix={comparisonSectionStyle}>
        <header mix={comparisonHeaderStyle}>
          <h2 mix={comparisonHeadingStyle}>The same response, eager and lazy</h2>
          <div mix={comparisonDescriptionStyle}>
            <p>
              Both Frames resolve the route below. The regular Frame is resolved during server
              rendering; LazyFrame waits to mount it in the browser. The checked-in fragment carries
              scoped CSS, keyframes, and a reduced-motion fallback.
            </p>
            <code mix={routeStyle}>{frameHref}</code>
          </div>
        </header>

        <div mix={comparisonGridStyle}>
          <article data-delivery="eager" mix={deliveryCardStyle}>
            <header mix={deliveryHeaderStyle}>
              <h3 mix={deliveryHeadingStyle}>Regular Frame</h3>
              <p mix={deliveryDetailStyle}>
                <strong>Initial document.</strong> Resolved before the response is sent.
              </p>
            </header>
            <div mix={frameShellStyle}>
              <Frame src={frameHref} />
            </div>
          </article>

          <article data-delivery="lazy" mix={deliveryCardStyle}>
            <header mix={deliveryHeaderStyle}>
              <h3 mix={deliveryHeadingStyle}>LazyFrame</h3>
              <p mix={deliveryDetailStyle}>
                <strong>Near the viewport.</strong> Requested once, retained, and paused offscreen.
              </p>
            </header>
            <div mix={frameShellStyle}>
              <LazyFrame
                src={frameHref}
                pauseAnimationsWhenInactive
                fallback={
                  <div class="frame-status frame-status--fetching">
                    <span class="frame-status__dot" aria-hidden="true" />
                    <span>
                      <strong>Request in progress</strong>
                      <small>The motion response has not arrived yet.</small>
                    </span>
                  </div>
                }
              >
                <div class="frame-status frame-status--waiting">
                  <span class="frame-status__dot" aria-hidden="true" />
                  <span>
                    <strong>Not requested</strong>
                    <small>The browser has not requested the motion route.</small>
                  </span>
                </div>
              </LazyFrame>
            </div>
          </article>
        </div>
      </section>
    )
  }
}

function ExhibitSection(handle: Handle<{ exhibit: Exhibit; index: number }>) {
  return () => {
    let { exhibit, index } = handle.props
    let frameHref = getFrameHref(exhibit)
    let ordinal = String(index + 1).padStart(2, '0')

    return (
      <section id={exhibit.id} mix={exhibitSectionStyle}>
        <div mix={sectionGridStyle}>
          <header mix={sectionHeaderStyle}>
            <p mix={sectionIndexStyle}>
              <span>{ordinal}</span>
              <span>{categoryLabel(exhibit.kind)}</span>
            </p>
            <h2 mix={sectionHeadingStyle}>{exhibit.title}</h2>
            <p mix={sectionDescriptionStyle}>{exhibit.description}</p>
            <code mix={routeStyle}>{frameHref}</code>
          </header>

          <div mix={frameShellStyle}>
            <LazyFrame
              src={frameHref}
              fallback={
                <div class="frame-status frame-status--fetching">
                  <span class="frame-status__dot" aria-hidden="true" />
                  <span>
                    <strong>Request in progress</strong>
                    <small>The Frame response has not arrived yet.</small>
                  </span>
                </div>
              }
            >
              <div class="frame-status frame-status--waiting">
                <span class="frame-status__dot" aria-hidden="true" />
                <span>
                  <strong>Not requested</strong>
                  <small>The browser will request it inside the preload margin.</small>
                </span>
              </div>
            </LazyFrame>
          </div>
        </div>
      </section>
    )
  }
}

function getFrameHref(exhibit: Exhibit): string {
  switch (exhibit.kind) {
    case 'html':
      return routes.frames.html.href({ id: exhibit.id })
    case 'ui':
      return routes.frames.ui.href({ id: exhibit.id })
    case 'interactive':
      return routes.frames.interactive.href({ id: exhibit.id })
  }
}

function categoryLabel(kind: Exhibit['kind']): string {
  switch (kind) {
    case 'html':
      return 'Static HTML'
    case 'ui':
      return 'Server Remix UI'
    case 'interactive':
      return 'Remix UI + client entry'
  }
}

const demoControlsStyle = css({
  position: 'fixed',
  zIndex: 20,
  top: '16px',
  right: '16px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  border: '1px solid var(--control-border)',
  borderRadius: '10px',
  padding: '8px',
  backgroundColor: 'var(--control-bg)',
  boxShadow: '0 6px 20px var(--control-shadow)',
  color: 'var(--control-text)',
  transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease',
  '@media (max-width: 560px)': {
    top: '8px',
    right: '8px',
    left: '8px',
    justifyContent: 'space-between',
  },
})

const latencyToggleStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  '@media (max-width: 560px)': {
    gap: '10px',
    '& small': {
      display: 'none',
    },
  },
})

const latencyStatusStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
})

const latencyDotStyle = css({
  flex: '0 0 auto',
  width: '9px',
  height: '9px',
  borderRadius: '50%',
})

const latencyDotEnabledStyle = css({
  backgroundColor: '#d4543f',
  boxShadow: '0 0 0 5px rgba(212, 84, 63, 0.13)',
})

const latencyDotDisabledStyle = css({
  backgroundColor: 'var(--control-muted)',
})

const latencyLabelStyle = css({
  display: 'block',
  fontSize: '12px',
})

const latencyDetailStyle = css({
  display: 'block',
  marginTop: '2px',
  fontSize: '10px',
  color: 'var(--control-muted)',
})

const latencyButtonStyle = css({
  minHeight: '36px',
  border: '1px solid var(--control-border)',
  borderRadius: '6px',
  padding: '7px 11px',
  backgroundColor: 'var(--control-button-bg)',
  color: 'var(--control-text)',
  font: 'inherit',
  fontSize: '11px',
  fontWeight: 750,
  cursor: 'pointer',
  '&:hover': {
    borderColor: 'var(--control-border-hover)',
    backgroundColor: 'var(--control-button-hover)',
  },
  '&:focus-visible': {
    outline: '3px solid var(--focus-ring)',
    outlineOffset: '2px',
  },
})

const heroStyle = css({
  minHeight: 'max(100svh, 760px)',
  display: 'grid',
  alignItems: 'center',
  padding: 'clamp(96px, 10vw, 132px) clamp(24px, 6vw, 76px) 72px',
  backgroundColor: 'var(--hero-bg)',
  color: 'var(--hero-text)',
  transition: 'background-color 180ms ease',
})

const heroInnerStyle = css({
  width: 'min(1120px, 100%)',
  margin: '0 auto',
})

const heroHeadingStyle = css({
  maxWidth: '980px',
  margin: '0 0 32px',
  fontSize: 'clamp(52px, 9vw, 112px)',
  fontWeight: 760,
  lineHeight: 0.92,
  letterSpacing: '-0.065em',
})

const heroCopyStyle = css({
  maxWidth: '680px',
  margin: 0,
  fontSize: 'clamp(18px, 2vw, 24px)',
  lineHeight: 1.45,
  color: 'var(--hero-muted)',
  '& code': {
    color: 'var(--focus-ring)',
  },
})

const flowStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  margin: 'clamp(56px, 9vh, 88px) 0 0',
  padding: 0,
  borderTop: '1px solid var(--hero-rule)',
  borderBottom: '1px solid var(--hero-rule)',
  listStyle: 'none',
  '& li + li': {
    borderLeft: '1px solid var(--hero-rule)',
  },
  '@media (max-width: 760px)': {
    gridTemplateColumns: '1fr',
    '& li + li': {
      borderTop: '1px solid var(--hero-rule)',
      borderLeft: 0,
    },
  },
})

const flowItemStyle = css({
  display: 'grid',
  gridTemplateColumns: '28px 1fr',
  gap: '14px',
  minHeight: '112px',
  alignItems: 'start',
  padding: '22px 24px',
  fontSize: '14px',
  lineHeight: 1.5,
  color: 'var(--hero-copy)',
})

const flowNumberStyle = css({
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--focus-ring)',
})

const scrollCueStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '14px',
  marginTop: '52px',
  borderBottom: '1px solid color-mix(in srgb, var(--hero-text) 40%, transparent)',
  paddingBottom: '6px',
  color: 'var(--hero-text)',
  fontSize: '13px',
  fontWeight: 700,
  textDecoration: 'none',
  '&:hover': {
    borderColor: 'var(--focus-ring)',
    color: 'var(--focus-ring)',
  },
})

const mainStyle = css({
  width: 'min(1120px, calc(100% - 40px))',
  margin: '0 auto',
})

const introStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, 0.8fr) minmax(280px, 1fr)',
  gap: 'clamp(32px, 7vw, 96px)',
  alignItems: 'start',
  padding: '120px 0 72px',
  '@media (max-width: 720px)': {
    gridTemplateColumns: '1fr',
  },
})

const introHeadingStyle = css({
  maxWidth: '620px',
  margin: 0,
  fontSize: 'clamp(34px, 4.5vw, 58px)',
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: '-0.045em',
  color: 'var(--page-heading)',
})

const introCopyStyle = css({
  maxWidth: '660px',
  margin: 0,
  fontSize: '17px',
  lineHeight: 1.65,
  color: 'var(--page-muted)',
})

const comparisonSectionStyle = css({
  minHeight: '105svh',
  display: 'grid',
  alignContent: 'center',
  gap: '52px',
  padding: '120px 0',
  scrollMarginTop: '84px',
})

const comparisonHeaderStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, 0.9fr) minmax(280px, 0.65fr)',
  alignItems: 'end',
  gap: 'clamp(32px, 8vw, 112px)',
  '@media (max-width: 760px)': {
    gridTemplateColumns: '1fr',
  },
})

const comparisonHeadingStyle = css({
  maxWidth: '700px',
  margin: 0,
  fontSize: 'clamp(40px, 5.5vw, 68px)',
  lineHeight: 1,
  letterSpacing: '-0.05em',
  color: 'var(--page-text)',
})

const comparisonDescriptionStyle = css({
  '& p': {
    margin: '0 0 18px',
    fontSize: '15px',
    lineHeight: 1.65,
    color: 'var(--page-muted)',
  },
})

const comparisonGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '20px',
  '@media (max-width: 900px)': {
    gridTemplateColumns: '1fr',
  },
})

const deliveryCardStyle = css({
  minWidth: 0,
  border: '1px solid var(--surface-border)',
  borderRadius: '10px',
  padding: 'clamp(12px, 2vw, 18px)',
  backgroundColor: 'var(--surface-bg)',
  transition: 'background-color 180ms ease, border-color 180ms ease',
})

const deliveryHeaderStyle = css({
  minHeight: '104px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '24px',
  padding: '8px 8px 20px',
  '@media (max-width: 520px)': {
    flexDirection: 'column',
    gap: '12px',
  },
})

const deliveryHeadingStyle = css({
  margin: 0,
  fontSize: '22px',
  lineHeight: 1.1,
  letterSpacing: '-0.035em',
  color: 'var(--page-heading)',
})

const deliveryDetailStyle = css({
  maxWidth: '230px',
  margin: 0,
  fontSize: '12px',
  lineHeight: 1.55,
  color: 'var(--page-muted)',
  '& strong': {
    color: 'var(--page-heading)',
  },
})

const exhibitSectionStyle = css({
  minHeight: '100svh',
  display: 'grid',
  alignItems: 'center',
  borderTop: '1px solid var(--page-rule)',
  padding: '12vh 0',
  scrollMarginTop: '84px',
})

const sectionGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(250px, 0.62fr) minmax(0, 1fr)',
  alignItems: 'center',
  gap: 'clamp(42px, 8vw, 116px)',
  '@media (max-width: 820px)': {
    gridTemplateColumns: '1fr',
  },
})

const sectionHeaderStyle = css({
  alignSelf: 'start',
})

const sectionIndexStyle = css({
  display: 'flex',
  gap: '14px',
  margin: '0 0 22px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '11px',
  lineHeight: 1.4,
  color: 'var(--page-subtle)',
  '& span:first-child': {
    fontWeight: 700,
    color: 'var(--page-heading)',
  },
})

const sectionHeadingStyle = css({
  margin: 0,
  fontSize: 'clamp(34px, 4.6vw, 62px)',
  lineHeight: 0.98,
  letterSpacing: '-0.055em',
  color: 'var(--page-text)',
})

const sectionDescriptionStyle = css({
  margin: '22px 0 20px',
  fontSize: '16px',
  lineHeight: 1.65,
  color: 'var(--page-muted)',
})

const routeStyle = css({
  display: 'inline-block',
  maxWidth: '100%',
  overflow: 'hidden',
  fontSize: '11px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--page-subtle)',
})

const frameShellStyle = css({
  minWidth: 0,
  minHeight: '320px',
  border: '1px solid var(--surface-border)',
  borderRadius: '10px',
  padding: '6px',
  backgroundColor: 'var(--frame-shell-bg)',
  '& .frame-status': {
    minHeight: '304px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    border: '1px dashed var(--placeholder-border)',
    borderRadius: '6px',
    padding: '24px',
    backgroundColor: 'var(--placeholder-bg)',
    color: 'var(--placeholder-text)',
  },
  '& .frame-status__dot': {
    flex: '0 0 auto',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: 'var(--placeholder-dot)',
  },
  '& .frame-status strong': {
    display: 'block',
    fontSize: '13px',
    color: 'var(--placeholder-heading)',
  },
  '& .frame-status small': {
    display: 'block',
    marginTop: '4px',
    fontSize: '11px',
    lineHeight: 1.5,
  },
  '& .frame-status--fetching .frame-status__dot': {
    backgroundColor: '#d4543f',
    boxShadow: '0 0 0 6px rgba(212, 84, 63, 0.12)',
  },
  '& .plain-frame': {
    minHeight: '304px',
    border: '1px solid var(--plain-border)',
    borderRadius: '6px',
    padding: 'clamp(24px, 4vw, 42px)',
    backgroundColor: 'var(--plain-bg)',
    color: 'var(--plain-text)',
  },
  '& .plain-frame__header': {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '24px',
    marginBottom: '28px',
  },
  '& .plain-frame__label, & .plain-frame__time': {
    margin: 0,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '11px',
    color: 'var(--plain-muted)',
  },
  '& .plain-frame h3': {
    maxWidth: '620px',
    margin: 0,
    fontFamily: 'Georgia, Times New Roman, serif',
    fontSize: 'clamp(25px, 3vw, 38px)',
    fontWeight: 500,
    lineHeight: 1.12,
    letterSpacing: '-0.025em',
  },
  '& .plain-frame ul': {
    display: 'grid',
    gap: '9px',
    margin: '28px 0',
    paddingLeft: '21px',
    fontSize: '14px',
    lineHeight: 1.5,
    color: 'var(--plain-list)',
  },
  '& .plain-frame__note': {
    margin: 0,
    borderTop: '1px solid var(--plain-rule)',
    paddingTop: '16px',
    fontSize: '11px',
    lineHeight: 1.5,
    color: 'var(--plain-muted)',
  },
})

const footerStyle = css({
  minHeight: '55svh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '80px 24px',
  backgroundColor: 'var(--footer-bg)',
  textAlign: 'center',
  color: 'var(--footer-text)',
  transition: 'background-color 180ms ease, color 180ms ease',
})

const footerHeadingStyle = css({
  maxWidth: '860px',
  margin: 0,
  fontSize: 'clamp(38px, 6vw, 76px)',
  lineHeight: 0.98,
  letterSpacing: '-0.055em',
})

const footerLinkStyle = css({
  marginTop: '42px',
  borderBottom: '1px solid var(--footer-muted)',
  paddingBottom: '5px',
  color: 'var(--footer-text)',
  fontSize: '13px',
  fontWeight: 700,
  textDecoration: 'none',
  '&:hover': {
    borderColor: 'var(--footer-text)',
  },
})
