import { css } from 'remix/component'
import type { BuildAction } from 'remix/fetch-router'

import { MessageStream } from '../assets/message-stream.tsx'
import type { routes } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'
import { getMessageLimit } from '../utils/message-limit.ts'
import { render } from '../utils/render.ts'

export const homeAction = {
  handler(context) {
    let limit = getMessageLimit(context.url)

    return render(
      <Layout>
        <h1 mix={css({ color: '#333', marginBottom: '0.5rem' })}>Server-Sent Events Demo</h1>
        <p mix={css({ color: '#666', marginBottom: '2rem' })}>
          Real-time updates with compression middleware
        </p>

        <div
          mix={css({
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            marginBottom: '1.5rem',
          })}
        >
          <label
            mix={css({
              display: 'block',
              fontWeight: 600,
              marginBottom: '0.5rem',
              color: '#333',
            })}
          >
            Compression:
          </label>
          <div
            mix={css({
              padding: '0.5rem',
              background: '#f8f9fa',
              borderRadius: '4px',
              color: '#666',
            })}
          >
            Encoding is negotiated automatically via{' '}
            <code
              mix={css({
                background: '#f5f5f5',
                padding: '0.2rem 0.4rem',
                borderRadius: '3px',
                fontFamily: "'Courier New', monospace",
                fontSize: '0.9em',
              })}
            >
              Accept-Encoding
            </code>{' '}
            header.
            <br />
            Open DevTools Network tab to see{' '}
            <code
              mix={css({
                background: '#f5f5f5',
                padding: '0.2rem 0.4rem',
                borderRadius: '3px',
                fontFamily: "'Courier New', monospace",
                fontSize: '0.9em',
              })}
            >
              Content-Encoding
            </code>{' '}
            response header.
          </div>
        </div>

        <div
          mix={css({
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            marginBottom: '1.5rem',
          })}
        >
          <label
            mix={css({
              display: 'block',
              fontWeight: 600,
              marginBottom: '0.5rem',
              color: '#333',
            })}
          >
            Message Limit:
          </label>
          <div
            mix={css({
              padding: '0.5rem',
              background: '#f8f9fa',
              borderRadius: '4px',
              color: '#666',
            })}
          >
            {limit ? (
              <>
                Stream will close after <strong>{limit}</strong> message{limit === 1 ? '' : 's'}.
              </>
            ) : (
              <>
                No limit set.{' '}
                <a href="?limit=10" mix={css({ color: '#007bff', textDecoration: 'underline' })}>
                  Add{' '}
                  <code
                    mix={css({
                      background: '#f5f5f5',
                      padding: '0.2rem 0.4rem',
                      borderRadius: '3px',
                      fontFamily: "'Courier New', monospace",
                      fontSize: '0.9em',
                    })}
                  >
                    ?limit=10
                  </code>{' '}
                  to the URL
                </a>{' '}
                to limit messages.
              </>
            )}
          </div>
        </div>

        <MessageStream setup={{ limit }} />
      </Layout>,
    )
  },
} satisfies BuildAction<'GET', typeof routes.home>
