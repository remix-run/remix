import { clientEntry, css, on, type Handle } from 'remix/ui'

export const CourseFilterInput = clientEntry(
  import.meta.url,
  function CourseFilterInput(handle: Handle<{ query: string }>) {
    return () => (
      <input
        id="course-filter"
        name="q"
        type="search"
        value={handle.props.query}
        placeholder="Search by course name"
        mix={[
          filterInputStyle,
          on('input', (event) => {
            event.currentTarget.form?.requestSubmit()
          }),
        ]}
      />
    )
  },
)

const filterInputStyle = css({
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
})
