import { fileURLToPath } from 'node:url'

import { openLazyFile } from 'remix/fs'
import { createFileResponse } from 'remix/response/file'
import { createController } from 'remix/router'
import { css, type Handle } from 'remix/component'

import {
  getExhibit,
  motionArtifact,
  type InteractiveExhibit,
  type UiExhibit,
} from '../../data/exhibits.ts'
import { routes } from '../../routes.ts'
import { FramePlayground } from './public/frame-playground.tsx'

export const framesController = createController(routes.frames, {
  actions: {
    async html({ params, request }) {
      let filename = htmlFrameFiles.get(params.id)
      if (filename === undefined) return notFound()

      return createFileResponse(openLazyFile(filename), request, {
        cacheControl: frameCacheControl,
        acceptRanges: false,
      })
    },

    async ui({ params, render }) {
      let exhibit = getExhibit(params.id)
      if (exhibit?.kind !== 'ui') return notFound()

      return render(
        <MetricFrame exhibit={exhibit} servedAt={formatTime(new Date())} />,
        frameResponseInit,
      )
    },

    async interactive({ params, render }) {
      let exhibit = getExhibit(params.id)
      if (exhibit?.kind !== 'interactive') return notFound()

      return render(
        <InteractiveFrame exhibit={exhibit} servedAt={formatTime(new Date())} />,
        frameResponseInit,
      )
    },
  },
})

function MetricFrame(handle: Handle<{ exhibit: UiExhibit; servedAt: string }>) {
  return () => {
    let { exhibit, servedAt } = handle.props

    return (
      <article
        mix={css({
          borderRadius: '6px',
          padding: 'clamp(24px, 4vw, 42px)',
          backgroundColor: 'var(--server-frame-bg)',
          color: 'var(--server-frame-text)',
          transition: 'background-color 180ms ease, color 180ms ease',
        })}
      >
        <div mix={uiFrameHeaderStyle}>
          <h3
            mix={css({
              maxWidth: '520px',
              margin: 0,
              fontSize: 'clamp(22px, 3vw, 34px)',
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
            })}
          >
            {exhibit.metricLabel}
          </h3>
          <p
            mix={css({
              margin: 0,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '11px',
              color: 'var(--server-frame-muted)',
              whiteSpace: 'nowrap',
            })}
          >
            Delivered at <time>{servedAt}</time>
          </p>
        </div>

        <div
          mix={css({
            display: 'grid',
            gap: '16px',
            marginTop: '42px',
            paddingBottom: '32px',
            borderBottom: '1px solid var(--server-frame-rule)',
          })}
        >
          <p
            mix={css({
              margin: 0,
              fontSize: 'clamp(48px, 8vw, 86px)',
              fontWeight: 800,
              lineHeight: 0.9,
              letterSpacing: '-0.07em',
              color: 'var(--server-frame-highlight)',
            })}
          >
            {exhibit.metric}
          </p>
          <p
            mix={css({
              margin: 0,
              paddingBottom: '5px',
              fontSize: '15px',
              lineHeight: 1.5,
              color: 'var(--server-frame-copy)',
            })}
          >
            {exhibit.trend}
          </p>
        </div>

        <ul
          mix={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '12px',
            margin: '28px 0 0',
            padding: 0,
            listStyle: 'none',
            '@media (max-width: 720px)': {
              gridTemplateColumns: '1fr',
            },
          })}
        >
          {exhibit.details.map((detail) => (
            <li
              key={detail}
              mix={css({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '13px',
                lineHeight: 1.4,
                color: 'var(--server-frame-detail)',
              })}
            >
              <span
                aria-hidden="true"
                mix={css({
                  flex: '0 0 auto',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--server-frame-accent)',
                })}
              />
              {detail}
            </li>
          ))}
        </ul>
      </article>
    )
  }
}

function InteractiveFrame(handle: Handle<{ exhibit: InteractiveExhibit; servedAt: string }>) {
  return () => {
    let { exhibit, servedAt } = handle.props

    return (
      <article
        mix={css({
          border: '1px solid var(--interactive-border)',
          borderRadius: '6px',
          padding: 'clamp(24px, 4vw, 42px)',
          backgroundColor: 'var(--interactive-bg)',
          color: 'var(--interactive-text)',
          transition: 'background-color 180ms ease, border-color 180ms ease, color 180ms ease',
        })}
      >
        <div mix={uiFrameHeaderStyle}>
          <h3
            mix={css({
              maxWidth: '520px',
              margin: 0,
              fontSize: 'clamp(22px, 3vw, 34px)',
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
            })}
          >
            {exhibit.prompt}
          </h3>
        </div>

        <FramePlayground
          initialCount={exhibit.initialCount}
          actionLabel={exhibit.actionLabel}
          accent={exhibit.accent}
          servedAt={servedAt}
        />
      </article>
    )
  }
}

function notFound(): Response {
  return new Response('Frame example not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
  })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

const htmlFrameFiles = new Map([
  [motionArtifact.id, fileURLToPath(new URL('./html/edition-orbit.html', import.meta.url))],
  ['field-notes', fileURLToPath(new URL('./html/field-notes.html', import.meta.url))],
  ['packing-list', fileURLToPath(new URL('./html/packing-list.html', import.meta.url))],
  ['reading-list', fileURLToPath(new URL('./html/reading-list.html', import.meta.url))],
])

const frameCacheControl =
  process.env.NODE_ENV === 'production'
    ? 'public, max-age=300, stale-while-revalidate=3600'
    : 'no-store'

const frameResponseInit = {
  headers: { 'Cache-Control': frameCacheControl },
} satisfies ResponseInit

const uiFrameHeaderStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '24px',
  '@media (max-width: 640px)': {
    flexDirection: 'column',
  },
})
