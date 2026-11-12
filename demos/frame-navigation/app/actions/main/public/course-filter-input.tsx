import type { Handle } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'

export const CourseFilterInput = clientEntry(
  import.meta.url,
  function CourseFilterInput(handle: Handle<{ filter: { query: string } }>) {
    let serverFilter = handle.props.filter
    let query = serverFilter.query
    return () => {
      if (handle.props.filter !== serverFilter) {
        serverFilter = handle.props.filter
        if (query.trim() !== serverFilter.query) query = serverFilter.query
      }
      return (
        <input
          id="course-filter"
          name="q"
          type="search"
          value={query}
          placeholder="Search by course name"
          mix={[
            on('input', (event) => {
              query = event.currentTarget.value
              handle.update()
              event.currentTarget.form?.requestSubmit()
            }),
            css({
              flex: '1 1 16rem',
              minWidth: 0,
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.65rem 0.75rem',
              font: 'inherit',
              color: '#0f172a',
              backgroundColor: '#ffffff',
              '&:focus': {
                borderColor: '#2563eb',
                outline: '2px solid #bfdbfe',
                outlineOffset: '1px',
              },
            }),
          ]}
        />
      )
    }
  },
)
