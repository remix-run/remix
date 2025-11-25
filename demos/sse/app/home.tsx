import type { BuildRouteHandler } from '@remix-run/fetch-router'

import type { routes } from '../routes.ts'

import { MessageStream } from './assets/message-stream.tsx'
import { Layout } from './layout.tsx'
import { render } from './utils/render.ts'

export let home: BuildRouteHandler<'GET', typeof routes.home> = (context) => {
  let limitParam = context.url.searchParams.get('limit')
  let limit = limitParam ? parseInt(limitParam, 10) : null
  if (!limit || !isFinite(limit)) limit = null

  return render(
    <Layout>
      <h1 css={{ color: '#333', marginBottom: '0.5rem' }}>Server-Sent Events Demo</h1>
      <p css={{ color: '#666', marginBottom: '2rem' }}>
        Real-time updates with compression middleware
      </p>

      <div
        css={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          marginBottom: '1.5rem',
        }}
      >
        <label
          css={{
            display: 'block',
            fontWeight: 600,
            marginBottom: '0.5rem',
            color: '#333',
          }}
        >
          Compression:
        </label>
        <div
          css={{
            padding: '0.5rem',
            background: '#f8f9fa',
            borderRadius: '4px',
            color: '#666',
          }}
        >
          Encoding is negotiated automatically via{' '}
          <code
            css={{
              background: '#f5f5f5',
              padding: '0.2rem 0.4rem',
              borderRadius: '3px',
              fontFamily: "'Courier New', monospace",
              fontSize: '0.9em',
            }}
          >
            Accept-Encoding
          </code>{' '}
          header.
          <br />
          Open DevTools Network tab to see{' '}
          <code
            css={{
              background: '#f5f5f5',
              padding: '0.2rem 0.4rem',
              borderRadius: '3px',
              fontFamily: "'Courier New', monospace",
              fontSize: '0.9em',
            }}
          >
            Content-Encoding
          </code>{' '}
          response header.
        </div>
      </div>

      <div
        css={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          marginBottom: '1.5rem',
        }}
      >
        <label
          css={{
            display: 'block',
            fontWeight: 600,
            marginBottom: '0.5rem',
            color: '#333',
          }}
        >
          Message Limit:
        </label>
        <div
          css={{
            padding: '0.5rem',
            background: '#f8f9fa',
            borderRadius: '4px',
            color: '#666',
          }}
        >
          {limit ? (
            <>
              Stream will close after <strong>{limit}</strong> message{limit === 1 ? '' : 's'}.
            </>
          ) : (
            <>
              No limit set. Add{' '}
              <code
                css={{
                  background: '#f5f5f5',
                  padding: '0.2rem 0.4rem',
                  borderRadius: '3px',
                  fontFamily: "'Courier New', monospace",
                  fontSize: '0.9em',
                }}
              >
                ?limit=10
              </code>{' '}
              to the URL to limit messages.
            </>
          )}
        </div>
      </div>

      <MessageStream limit={limit} />
    </Layout>,
  )
}
