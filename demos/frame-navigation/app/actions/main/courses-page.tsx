import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { frames, routes } from '../../routes.ts'
import { CourseFilterInput } from './public/course-filter-input.tsx'

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
        <h1
          id="courses-heading"
          mix={css({
            marginTop: 0,
            fontSize: '1.8rem',
            color: '#0f172a',
          })}
        >
          Courses
        </h1>
        <p
          mix={css({
            marginTop: '0.5rem',
            color: '#475569',
            lineHeight: 1.7,
            maxWidth: '65ch',
          })}
        >
          Continue where you left off in each course track.
        </p>

        <form
          method="GET"
          action={routes.main.courses.href()}
          data-rmx-target={frames.courses}
          data-rmx-history="replace"
          data-rmx-reset-focus="manual"
          mix={css({
            marginTop: '1.5rem',
            maxWidth: '42rem',
          })}
        >
          <label
            for="course-filter"
            mix={css({
              display: 'block',
              marginBottom: '0.5rem',
              color: '#334155',
              fontSize: '0.9rem',
              fontWeight: 600,
            })}
          >
            Filter courses
          </label>
          <div
            mix={css({
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            })}
          >
            {/* A fresh snapshot distinguishes server renders with the same query from local edits. */}
            <CourseFilterInput filter={{ query }} />
            <button
              type="submit"
              mix={css({
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
              })}
            >
              Filter
            </button>
            {query ? (
              <a
                href={routes.main.courses.href()}
                data-rmx-target={frames.courses}
                mix={css({
                  color: '#1d4ed8',
                  fontWeight: 600,
                  textUnderlineOffset: '0.2em',
                })}
              >
                Clear
              </a>
            ) : null}
          </div>
        </form>

        <p
          id="course-results"
          role="status"
          mix={css({
            margin: '1.25rem 0 0',
            color: '#475569',
            fontSize: '0.9rem',
          })}
        >
          {query
            ? `${resultCount} ${resultCount === 1 ? 'course' : 'courses'} matching “${query}”`
            : `${resultCount} courses`}
        </p>

        {filteredCourses.length > 0 ? (
          <ul
            aria-labelledby="course-results"
            mix={css({
              listStyle: 'none',
              margin: '0.75rem 0 0',
              padding: 0,
              display: 'grid',
              gap: '0.75rem',
            })}
          >
            {filteredCourses.map((course) => (
              <li
                mix={css({
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '0.9rem 1rem',
                })}
              >
                {course}
              </li>
            ))}
          </ul>
        ) : (
          <p
            mix={css({
              marginTop: '0.75rem',
              border: '1px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '1rem',
              color: '#64748b',
            })}
          >
            Try a different course name.
          </p>
        )}
      </section>
    )
  }
}
