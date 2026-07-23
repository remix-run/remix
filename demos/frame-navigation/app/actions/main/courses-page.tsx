import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { frames, routes } from '../../routes.ts'

const courses = [
  'Introduction to Product Design',
  'Applied Statistics for Engineers',
  'Web Accessibility Foundations',
  'Data Visualization for the Web',
]

type MainCoursesPageProps = {
  query: string
}

export function MainCoursesPage(handle: Handle<MainCoursesPageProps>) {
  return () => {
    let query = handle.props.query
    let normalizedQuery = query.toLocaleLowerCase()
    let filteredCourses = courses.filter((course) =>
      course.toLocaleLowerCase().includes(normalizedQuery),
    )
    let resultCount = filteredCourses.length

    return (
      <section aria-labelledby="courses-heading">
        <h1 id="courses-heading" mix={titleStyle}>
          Courses
        </h1>
        <p mix={descriptionStyle}>Continue where you left off in each course track.</p>

        <form
          method="GET"
          action={routes.main.courses.href()}
          rmx-target={frames.courses}
          mix={filterFormStyle}
        >
          <label for="course-filter" mix={filterLabelStyle}>
            Filter courses
          </label>
          <div mix={filterControlsStyle}>
            <input
              id="course-filter"
              name="q"
              type="search"
              value={query}
              placeholder="Search by course name"
              mix={filterInputStyle}
            />
            <button type="submit" mix={filterButtonStyle}>
              Filter
            </button>
            {query ? (
              <a href={routes.main.courses.href()} rmx-target={frames.courses} mix={clearLinkStyle}>
                Clear
              </a>
            ) : null}
          </div>
        </form>

        <p id="course-results" role="status" mix={resultSummaryStyle}>
          {query
            ? `${resultCount} ${resultCount === 1 ? 'course' : 'courses'} matching “${query}”`
            : `${resultCount} courses`}
        </p>

        {filteredCourses.length > 0 ? (
          <ul aria-labelledby="course-results" mix={courseListStyle}>
            {filteredCourses.map((course) => (
              <li mix={courseItemStyle}>{course}</li>
            ))}
          </ul>
        ) : (
          <p mix={emptyStateStyle}>Try a different course name.</p>
        )}
      </section>
    )
  }
}

const titleStyle = css({
  marginTop: 0,
  fontSize: '1.8rem',
  color: '#0f172a',
})

const descriptionStyle = css({
  marginTop: '0.5rem',
  color: '#475569',
  lineHeight: 1.7,
  maxWidth: '65ch',
})

const filterFormStyle = css({
  marginTop: '1.5rem',
  maxWidth: '42rem',
})

const filterLabelStyle = css({
  display: 'block',
  marginBottom: '0.5rem',
  color: '#334155',
  fontSize: '0.9rem',
  fontWeight: 600,
})

const filterControlsStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '0.75rem',
})

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

const filterButtonStyle = css({
  border: '1px solid #1d4ed8',
  borderRadius: '8px',
  padding: '0.65rem 1rem',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  color: '#ffffff',
  backgroundColor: '#2563eb',
  '&:hover': {
    backgroundColor: '#1d4ed8',
  },
  '&:focus-visible': {
    outline: '2px solid #2563eb',
    outlineOffset: '2px',
  },
})

const clearLinkStyle = css({
  color: '#1d4ed8',
  fontWeight: 600,
  textUnderlineOffset: '0.2em',
})

const resultSummaryStyle = css({
  margin: '1.25rem 0 0',
  color: '#475569',
  fontSize: '0.9rem',
})

const courseListStyle = css({
  listStyle: 'none',
  margin: '0.75rem 0 0',
  padding: 0,
  display: 'grid',
  gap: '0.75rem',
})

const courseItemStyle = css({
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '0.9rem 1rem',
})

const emptyStateStyle = css({
  marginTop: '0.75rem',
  border: '1px dashed #cbd5e1',
  borderRadius: '12px',
  padding: '1rem',
  color: '#64748b',
})
