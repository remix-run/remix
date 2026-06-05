import { clientEntry, css, navigate, on, type Handle } from 'remix/ui'
import { Button } from 'remix/ui/button'
import { theme } from 'remix/ui/theme'

import { NewScheduleActionComponent } from './new-schedule-action.tsx'

type SidebarSchedule = {
  deleteHref: string
  href: string
  id: number
  name: string
}

type ScheduleSidebarProps = {
  activeScheduleId?: number
  csrfToken: string
  logoutHref: string
  schedules: SidebarSchedule[]
}

export const ScheduleSidebar = clientEntry(
  import.meta.url,
  function ScheduleSidebar(handle: Handle<ScheduleSidebarProps>) {
    let deletedScheduleIds = new Set<number>()
    let deletingScheduleIds = new Set<number>()
    let errorMessages = new Map<number, string>()

    return () => {
      let scheduleIds = new Set(handle.props.schedules.map((schedule) => schedule.id))

      for (let scheduleId of deletedScheduleIds) {
        if (!scheduleIds.has(scheduleId)) deletedScheduleIds.delete(scheduleId)
      }

      for (let scheduleId of deletingScheduleIds) {
        if (!scheduleIds.has(scheduleId)) deletingScheduleIds.delete(scheduleId)
      }

      for (let scheduleId of errorMessages.keys()) {
        if (!scheduleIds.has(scheduleId)) errorMessages.delete(scheduleId)
      }

      return (
        <aside aria-label="Schedules" mix={sidebarStyle}>
          <div mix={sidebarHeaderStyle}>
            <a href="/" mix={appTitleStyle}>
              Timeboxer
            </a>
            <form action={handle.props.logoutHref} method="post" mix={logoutFormStyle}>
              <input type="hidden" name="_csrf" value={handle.props.csrfToken} />
              <Button type="submit" tone="ghost" mix={logoutButtonStyle}>
                Logout
              </Button>
            </form>
          </div>

          <div mix={newScheduleRegionStyle}>
            <NewScheduleActionComponent csrfToken={handle.props.csrfToken} />
          </div>

          <div mix={scheduleScrollerStyle}>
            <nav aria-label="Schedule list" mix={scheduleListStyle}>
              {handle.props.schedules.map((schedule) =>
                deletedScheduleIds.has(schedule.id)
                  ? null
                  : scheduleSidebarRow({
                      active: schedule.id === handle.props.activeScheduleId,
                      deleting: deletingScheduleIds.has(schedule.id),
                      errorMessage: errorMessages.get(schedule.id) ?? null,
                      onDelete: () => deleteSchedule(schedule),
                      schedule,
                    }),
              )}
            </nav>
          </div>
        </aside>
      )
    }

    async function deleteSchedule(schedule: SidebarSchedule) {
      if (deletingScheduleIds.has(schedule.id)) return

      deletingScheduleIds.add(schedule.id)
      errorMessages.delete(schedule.id)
      await handle.update()

      try {
        let [result] = await Promise.all([
          fetch(schedule.deleteHref, {
            headers: {
              Accept: 'application/json',
              'X-Csrf-Token': handle.props.csrfToken,
            },
            method: 'DELETE',
            signal: handle.signal,
          }).then(
            (response) => ({ response }),
            (error: unknown) => ({ error }),
          ),
          sleep(500),
        ])

        if (handle.signal.aborted) return
        if ('error' in result) throw result.error

        let { response } = result

        if (!response.ok) {
          errorMessages.set(schedule.id, await deleteScheduleErrorMessage(response))
          deletingScheduleIds.delete(schedule.id)
          await handle.update()
          return
        }

        let json = (await response.json()) as { nextScheduleHref?: unknown }
        let nextScheduleHref =
          typeof json.nextScheduleHref === 'string' ? json.nextScheduleHref : '/'

        if (schedule.id === handle.props.activeScheduleId) {
          await navigate(nextScheduleHref)
          return
        }

        deletedScheduleIds.add(schedule.id)
        deletingScheduleIds.delete(schedule.id)
        await handle.update()
      } catch {
        if (handle.signal.aborted) return

        errorMessages.set(schedule.id, 'Could not delete schedule. Please try again.')
        deletingScheduleIds.delete(schedule.id)
        await handle.update()
      }
    }
  },
)

function scheduleSidebarRow({
  active,
  deleting,
  errorMessage,
  onDelete,
  schedule,
}: {
  active: boolean
  deleting: boolean
  errorMessage: string | null
  onDelete: () => void
  schedule: SidebarSchedule
}) {
  let errorId = `delete-schedule-${schedule.id}-error`

  return (
    <div key={schedule.id} mix={scheduleItemStyle}>
      <a
        aria-current={active ? 'page' : undefined}
        data-active={active ? 'true' : undefined}
        data-deleting={deleting ? 'true' : undefined}
        href={schedule.href}
        mix={scheduleLinkStyle}
      >
        <span mix={scheduleNameStyle}>{schedule.name}</span>
        <button
          aria-describedby={errorMessage ? errorId : undefined}
          aria-label={`Delete ${schedule.name}`}
          disabled={deleting}
          type="button"
          mix={[
            deleteButtonStyle,
            on('click', (event) => {
              event.preventDefault()
              event.stopPropagation()
              onDelete()
            }),
          ]}
        >
          {deleting ? spinnerIcon() : xIcon()}
        </button>
      </a>
      {errorMessage ? (
        <small id={errorId} role="alert" mix={deleteErrorStyle}>
          {errorMessage}
        </small>
      ) : null}
    </div>
  )
}

function xIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" mix={iconStyle}>
      <path
        d="M4.25 4.25 11.75 11.75M11.75 4.25 4.25 11.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
    </svg>
  )
}

function spinnerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" mix={[iconStyle, spinnerStyle]}>
      <circle
        cx="8"
        cy="8"
        fill="none"
        r="6"
        stroke="currentColor"
        strokeDasharray="28"
        strokeDashoffset="8"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, durationMs))
}

async function deleteScheduleErrorMessage(response: Response) {
  let contentType = response.headers.get('Content-Type') ?? ''

  if (contentType.includes('application/json')) {
    try {
      let body = (await response.json()) as { error?: unknown }
      if (typeof body.error === 'string') return body.error
    } catch {
      // Fall through to the status-based fallback below.
    }
  }

  if (response.status === 401) return 'Please sign in before deleting this schedule.'
  if (response.status === 403) return 'Could not verify this request. Please refresh and try again.'
  if (response.status === 404) return 'Schedule was already deleted.'

  return 'Could not delete schedule. Please try again.'
}

const sidebarStyle = css({
  backgroundColor: theme.surface.lvl0,
  borderRight: `1px solid ${theme.colors.border.strong}`,
  display: 'grid',
  gridTemplateRows: '56px 32px minmax(0, 1fr)',
  minHeight: 0,
})

const sidebarHeaderStyle = css({
  alignItems: 'center',
  display: 'flex',
  gap: theme.space.sm,
  justifyContent: 'space-between',
  padding: `${theme.space.sm} ${theme.space.md}`,
})

const appTitleStyle = css({
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.xl,
  fontWeight: theme.fontWeight.bold,
  letterSpacing: theme.letterSpacing.tight,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
})

const logoutFormStyle = css({
  margin: 0,
})

const logoutButtonStyle = css({
  color: theme.colors.text.secondary,
})

const scheduleScrollerStyle = css({
  minHeight: 0,
  overflowY: 'auto',
  padding: `${theme.space.xl} ${theme.space.lg}`,
})

const scheduleListStyle = css({
  display: 'grid',
  gap: theme.space.sm,
})

const newScheduleRegionStyle = css({
  minHeight: 0,
  paddingInline: theme.space.md,
})

const scheduleItemStyle = css({
  display: 'grid',
  gap: theme.space.xs,
})

const scheduleLinkStyle = css({
  alignItems: 'center',
  borderRadius: theme.radius.md,
  color: theme.colors.text.primary,
  display: 'grid',
  gap: theme.space.xs,
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  minWidth: 0,
  padding: `${theme.space.xs} ${theme.space.xs} ${theme.space.xs} ${theme.space.sm}`,
  textDecoration: 'none',
  '& > button': {
    opacity: 0,
    pointerEvents: 'none',
  },
  '&:hover': {
    backgroundColor: theme.surface.lvl2,
  },
  '&:hover > button': {
    opacity: 1,
    pointerEvents: 'auto',
  },
  '&:focus-within': {
    backgroundColor: theme.surface.lvl2,
  },
  '&:focus-within > button': {
    opacity: 1,
    pointerEvents: 'auto',
  },
  "&[data-active='true']": {
    backgroundColor: theme.surface.lvl2,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
  "&[data-active='true'] > span": {
    fontWeight: theme.fontWeight.medium,
  },
  "&[data-deleting='true']": {
    opacity: 0.75,
  },
  "&[data-deleting='true'] > button": {
    opacity: 1,
    pointerEvents: 'auto',
  },
})

const scheduleNameStyle = css({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

const deleteButtonStyle = css({
  alignItems: 'center',
  backgroundColor: 'transparent',
  border: 0,
  borderRadius: theme.radius.sm,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  display: 'inline-flex',
  height: '1.5rem',
  justifyContent: 'center',
  margin: 0,
  padding: 0,
  width: '1.5rem',
  '&:hover': {
    color: theme.colors.action.danger.background,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
  '&:disabled': {
    cursor: 'default',
  },
})

const iconStyle = css({
  display: 'block',
  height: '1rem',
  width: '1rem',
})

const spinnerStyle = css({
  animation: 'timebox-sidebar-spin 700ms linear infinite',
  '@keyframes timebox-sidebar-spin': {
    from: {
      transform: 'rotate(0deg)',
    },
    to: {
      transform: 'rotate(360deg)',
    },
  },
})

const deleteErrorStyle = css({
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.xs,
  gridColumn: '1 / -1',
})
