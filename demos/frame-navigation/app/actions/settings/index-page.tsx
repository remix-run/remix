import { css } from 'remix/component'

export function Index() {
  return () => (
    <section>
      <h2
        mix={css({
          margin: 0,
          fontSize: '1.5rem',
          color: '#0f172a',
        })}
      >
        Settings overview
      </h2>
      <p
        mix={css({
          marginTop: '0.6rem',
          color: '#475569',
          lineHeight: 1.7,
          maxWidth: '70ch',
        })}
      >
        Configure your LMS experience, from profile details to grading visibility and connected
        learning tools.
      </p>
      <div
        mix={css({
          marginTop: '1rem',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          backgroundColor: '#ffffff',
          padding: '1rem',
        })}
      >
        <p
          mix={css({
            margin: 0,
            fontWeight: 600,
            color: '#0f172a',
          })}
        >
          Recommended setup
        </p>
        <p
          mix={css({
            margin: '0.5rem 0 0',
            color: '#64748b',
          })}
        >
          Complete profile, enable deadline reminders, and review privacy controls at least once
          this semester.
        </p>
      </div>
    </section>
  )
}
