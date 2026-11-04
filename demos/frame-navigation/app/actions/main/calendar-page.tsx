import { css } from 'remix/component'

export function MainCalendarPage() {
  return () => (
    <section>
      <h1
        mix={css({
          marginTop: 0,
          fontSize: '1.8rem',
          color: '#0f172a',
        })}
      >
        Calendar
      </h1>
      <p
        mix={css({
          marginTop: '0.5rem',
          color: '#475569',
          lineHeight: 1.7,
          maxWidth: '65ch',
        })}
      >
        Track class sessions, assignment due dates, and office hours.
      </p>

      <div
        mix={css({
          marginTop: '1.25rem',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '1rem',
          backgroundColor: '#ffffff',
        })}
      >
        <p
          mix={css({
            margin: 0,
            fontWeight: 600,
            color: '#0f172a',
          })}
        >
          Today
        </p>
        <p
          mix={css({
            margin: '0.5rem 0 0',
            color: '#334155',
          })}
        >
          11:00 AM - UX Research Workshop
        </p>
        <p
          mix={css({
            margin: '0.35rem 0 0',
            color: '#334155',
          })}
        >
          3:30 PM - Intro to Accessibility Quiz
        </p>
      </div>
    </section>
  )
}
