import { clientEntry, css, navigate, on, ref, type Handle, type Props } from 'remix/ui'
import { animateEntrance, animateExit, spring } from 'remix/ui/animation'
import button from 'remix/ui/button'
import { theme } from './design.ts'

type State = 'idle' | 'creating' | 'submitting'

export function NewScheduleActionComponent(handle: Handle<{ csrfToken: string }>) {
  return NewScheduleActionImplementation(handle)
}

export const NewScheduleAction = clientEntry(
  import.meta.url,
  function NewScheduleAction(handle: Handle<{ csrfToken: string }>) {
    return NewScheduleActionImplementation(handle)
  },
)

function NewScheduleActionImplementation(handle: Handle<{ csrfToken: string }>) {
  let state: State = 'idle'
  let buttonNode: HTMLButtonElement | null = null
  let errorMessage: string | null = null
  let input: HTMLInputElement | null = null
  let submittedName = ''

  async function cancelCreate() {
    if (state !== 'creating') return

    errorMessage = null
    submittedName = ''
    state = 'idle'
    await handle.update()
    buttonNode?.focus()
  }

  async function submitSchedule(form: HTMLFormElement) {
    let formData = new FormData(form)
    let name = String(formData.get('name') ?? '').trim()
    submittedName = name

    if (!name) {
      errorMessage = 'Name is required.'
      await handle.update()
      input?.select()
      return
    }

    errorMessage = null
    state = 'submitting'
    await handle.update()

    try {
      let [result] = await Promise.all([
        fetch(schedulesHref, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Csrf-Token': handle.props.csrfToken,
          },
          body: JSON.stringify({ name }),
          signal: handle.signal,
        }).then(
          (response) => ({ response }),
          (error: unknown) => ({ error }),
        ),
        sleep(500),
      ])

      if ('error' in result) throw result.error

      let { response } = result

      if (!response.ok) {
        errorMessage = await createScheduleErrorMessage(response)
        state = 'creating'
        await handle.update()
        input?.select()
        return
      }

      let { schedule } = await response.json()
      if (handle.signal.aborted) return

      let href = scheduleHref(schedule.id)
      await navigate(href)
      if (handle.signal.aborted) return

      state = 'idle'
      errorMessage = null
      submittedName = ''
      await handle.update()
    } catch (error) {
      if (handle.signal.aborted) return

      errorMessage = 'Could not create schedule. Please try again.'
      state = 'creating'
      await handle.update()
      input?.select()
    }
  }

  return () => {
    let content

    if (state === 'idle') {
      content = (
        <button
          type="button"
          mix={[
            button(),
            newScheduleButtonStyle,
            ref((node) => (buttonNode = node)),
            on('click', async () => {
              errorMessage = null
              submittedName = ''
              state = 'creating'
              await handle.update()
              input?.focus()
            }),
          ]}
        >
          <AddIcon mix={buttonIconStyle} />
          New schedule
        </button>
      )
    } else if (state === 'submitting') {
      content = (
        <div
          aria-live="polite"
          key="new-schedule-loading"
          mix={[
            creatingStyle,
            animateEntrance({
              opacity: 0,
              transform: 'scale(0.5)',
              ...spring('snappy'),
            }),
          ]}
        >
          <SpinnerIcon mix={spinnerStyle} />
          <span>Creating</span>
        </div>
      )
    } else {
      content = (
        <form
          aria-describedby={errorMessage ? scheduleNameErrorId : undefined}
          autoComplete="off"
          key="new-schedule-form"
          mix={[
            newScheduleFormStyle,
            animateExit({
              opacity: 0,
              transform: 'scale(0.5)',
              ...spring('snappy'),
            }),
            on('submit', (event) => {
              event.preventDefault()
              submitSchedule(event.currentTarget)
            }),
            on('focusout', (event) => {
              let nextTarget = event.relatedTarget

              if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                return
              }

              cancelCreate()
            }),
            on('keydown', (event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                cancelCreate()
              }
            }),
          ]}
        >
          <input
            aria-label="Schedule name"
            aria-describedby={errorMessage ? scheduleNameErrorId : undefined}
            aria-invalid={errorMessage ? true : undefined}
            autoComplete="off"
            name="name"
            placeholder="Schedule name"
            required
            type="text"
            defaultValue={submittedName}
            mix={[
              newScheduleInputStyle,
              ref((node) => (input = node)),
              on('input', () => {
                if (!errorMessage) return

                errorMessage = null
                handle.update()
              }),
            ]}
          />
          {errorMessage ? (
            <small id={scheduleNameErrorId} role="alert" mix={newScheduleErrorStyle}>
              {errorMessage}
            </small>
          ) : null}
        </form>
      )
    }

    return <div mix={newScheduleActionStyle}>{content}</div>
  }
}

function AddIcon(handle: Handle<Props<'svg'>>) {
  return () => (
    <svg
      {...handle.props}
      aria-hidden="true"
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 3.25v9.5M3.25 8h9.5"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="1.5"
      />
    </svg>
  )
}

function SpinnerIcon(handle: Handle<Props<'svg'>>) {
  return () => (
    <svg {...handle.props} aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path
        d="M8 2.5a5.5 5.5 0 1 1-5.5 5.5"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="1.5"
      />
    </svg>
  )
}

const schedulesHref = '/schedules'
const scheduleNameErrorId = 'new-schedule-name-error'

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, durationMs))
}

function scheduleHref(scheduleId: number | string) {
  return `/schedules/${encodeURIComponent(String(scheduleId))}`
}

async function createScheduleErrorMessage(response: Response) {
  let contentType = response.headers.get('Content-Type') ?? ''

  if (contentType.includes('application/json')) {
    try {
      let body = (await response.json()) as {
        error?: unknown
        fieldErrors?: {
          name?: unknown
        }
      }

      if (typeof body.fieldErrors?.name === 'string') return body.fieldErrors.name
      if (typeof body.error === 'string') return body.error
    } catch {
      // Fall through to the status-based fallback below.
    }
  }

  if (response.status === 401) return 'Please sign in before creating a schedule.'
  if (response.status === 403) return 'Could not verify this request. Please refresh and try again.'

  return 'Could not create schedule. Please try again.'
}

const newScheduleButtonStyle = css({
  height: '100%',
  width: '100%',
})

const buttonIconStyle = css({
  flexShrink: 0,
  height: '1em',
  width: '1em',
})

const newScheduleActionStyle = css({
  display: 'grid',
  height: '100%',
  minHeight: 0,
  '& > *': {
    gridArea: '1 / 1',
    minHeight: 0,
  },
})

const newScheduleFormStyle = css({
  display: 'block',
})

const newScheduleInputStyle = css({
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius,
  boxSizing: 'border-box',
  color: theme.colors.text.primary,
  font: 'inherit',
  fontSize: theme.fontSize.xs,
  minHeight: '28px',
  padding: `0 ${theme.space.md}`,
  width: '100%',
  '&:focus': {
    borderColor: theme.colors.focusRing,
    outline: `2px solid ${theme.colors.focusRing}`,
    outlineOffset: '2px',
  },
})

const newScheduleErrorStyle = css({
  color: theme.colors.danger,
  display: 'block',
  fontSize: theme.fontSize.xs,
  marginTop: theme.space.xs,
})

const creatingStyle = css({
  alignItems: 'center',
  color: theme.colors.text.secondary,
  display: 'flex',
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.medium,
  gap: theme.space.sm,
  height: '100%',
  justifyContent: 'center',
  minHeight: 0,
  paddingInline: theme.space.md,
  width: '100%',
})

const spinnerStyle = css({
  width: '1.25em',
  height: '1.25em',
  animation: 'timebox-spin 700ms linear infinite',
  '@keyframes timebox-spin': {
    from: {
      transform: 'rotate(0deg)',
    },
    to: {
      transform: 'rotate(360deg)',
    },
  },
})
