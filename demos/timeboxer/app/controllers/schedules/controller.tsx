import { Auth } from "remix/auth-middleware"
import { getCsrfToken } from "remix/csrf-middleware"
import { DataTableConstraintError, Database } from "remix/data-table"
import * as s from "remix/data-schema"
import { maxLength, minLength } from "remix/data-schema/checks"
import type { Controller } from "remix/fetch-router"

import {
  createSchedule,
  deleteSchedule,
  getScheduleDocument,
  listSchedules,
  replaceScheduleDocument,
  ScheduleDataError,
} from "../../data/schedules.ts"
import type { AppContext } from "../../router.ts"
import { routes } from "../../routes.ts"
import { render } from "../../utils/render.tsx"
import { createScheduleIcs } from "./ics.ts"
import { SchedulePage } from "./page.tsx"

const scheduleNameSchema = s
  .string()
  .transform((value) => value.trim())
  .pipe(minLength(1), maxLength(80))

const scheduleInputIdSchema = s.string().pipe(minLength(1), maxLength(80))

const scheduleBlockSchema = s.object({
  id: scheduleInputIdSchema,
  color: s.optional(s.nullable(s.string().pipe(maxLength(64)))),
  dayOfWeek: s
    .number()
    .refine(Number.isInteger, "dayOfWeek must be an integer."),
  endMinute: s
    .number()
    .refine(Number.isInteger, "endMinute must be an integer."),
  name: s
    .string()
    .transform((value) => value.trim())
    .pipe(minLength(1), maxLength(80)),
  startMinute: s
    .number()
    .refine(Number.isInteger, "startMinute must be an integer."),
})

const createScheduleSchema = s.object({
  name: scheduleNameSchema,
})

const replaceScheduleSchema = s.object({
  baseRevision: s
    .number()
    .refine(Number.isInteger, "baseRevision must be an integer."),
  blocks: s.array(scheduleBlockSchema),
  name: scheduleNameSchema,
})

export const schedulesController = {
  actions: {
    async index(context) {
      let auth = context.get(Auth)!
      if (!auth.ok) return unauthorized()

      let db = context.get(Database)!
      let userSchedules = await listSchedules(db, authUserId(auth))

      return Response.json({ schedules: userSchedules })
    },

    async create(context) {
      let auth = context.get(Auth)!
      if (!auth.ok) return unauthorized()

      let parsed = await parseJsonRequest(createScheduleSchema, context.request)
      if (!parsed.success) return validationError(parsed.issues)

      try {
        let db = context.get(Database)!
        let schedule = await createSchedule(
          db,
          authUserId(auth),
          parsed.value.name,
        )

        return Response.json({ schedule }, { status: 201 })
      } catch (error) {
        return handleCreateScheduleError(error)
      }
    },

    async destroy(context) {
      let auth = context.get(Auth)!
      if (!auth.ok) return unauthorized()

      let scheduleId = parseIntegerParam(
        context.params.scheduleId,
        "scheduleId",
      )
      if (scheduleId instanceof Response) return scheduleId

      try {
        let db = context.get(Database)!
        let userId = authUserId(auth)
        await deleteSchedule(db, userId, scheduleId)

        let schedules = await listSchedules(db, userId)
        let nextSchedule = schedules.at(0)

        return Response.json({
          deletedScheduleId: scheduleId,
          nextScheduleHref: nextSchedule
            ? routes.schedules.show.href({ scheduleId: String(nextSchedule.id) })
            : routes.home.index.href(),
        })
      } catch (error) {
        return handleScheduleError(error)
      }
    },

    async downloadIcs(context) {
      let auth = context.get(Auth)!
      if (!auth.ok) {
        return wantsJson(context.request)
          ? unauthorized()
          : Response.redirect(
              new URL(routes.auth.login.index.href(), context.request.url),
              302,
            )
      }

      let scheduleId = parseIntegerParam(
        context.params.scheduleId,
        "scheduleId",
      )
      if (scheduleId instanceof Response) return scheduleId

      try {
        let db = context.get(Database)!
        let schedule = await getScheduleDocument(
          db,
          authUserId(auth),
          scheduleId,
        )

        return new Response(createScheduleIcs(schedule), {
          headers: {
            "Cache-Control": "no-store",
            "Content-Disposition": `attachment; filename="${downloadFilename(schedule.name)}"`,
            "Content-Type": "text/calendar; charset=utf-8",
          },
        })
      } catch (error) {
        return handleScheduleError(error)
      }
    },

    async show(context) {
      let auth = context.get(Auth)!
      if (!auth.ok) {
        return wantsJson(context.request)
          ? unauthorized()
          : Response.redirect(
              new URL(routes.auth.login.index.href(), context.request.url),
              302,
            )
      }

      let scheduleId = parseIntegerParam(
        context.params.scheduleId,
        "scheduleId",
      )
      if (scheduleId instanceof Response) return scheduleId

      try {
        let db = context.get(Database)!
        let schedule = await getScheduleDocument(
          db,
          authUserId(auth),
          scheduleId,
        )

        if (wantsJson(context.request)) {
          return Response.json({ schedule })
        }

        let schedules = await listSchedules(db, authUserId(auth))

        return render(
          <SchedulePage
            activeScheduleId={schedule.id}
            csrfToken={getCsrfToken(context)}
            schedule={schedule}
            schedules={schedules}
          />,
          context.request,
        )
      } catch (error) {
        return handleScheduleError(error)
      }
    },

    async update(context) {
      let auth = context.get(Auth)!
      if (!auth.ok) return unauthorized()

      let scheduleId = parseIntegerParam(
        context.params.scheduleId,
        "scheduleId",
      )
      if (scheduleId instanceof Response) return scheduleId

      let parsed = await parseJsonRequest(
        replaceScheduleSchema,
        context.request,
      )
      if (!parsed.success) return validationError(parsed.issues)

      try {
        let db = context.get(Database)!
        let schedule = await replaceScheduleDocument(
          db,
          authUserId(auth),
          scheduleId,
          parsed.value,
        )

        return Response.json({ schedule })
      } catch (error) {
        return handleScheduleError(error)
      }
    },
  },
} satisfies Controller<typeof routes.schedules, AppContext>

async function parseJsonRequest<input, output>(
  schema: s.Schema<input, output>,
  request: Request,
) {
  try {
    return s.parseSafe(schema, await request.json())
  } catch {
    return {
      success: false,
      issues: [{ message: "Expected a valid JSON request body." }],
    } as const
  }
}

function parseIntegerParam(value: string, name: string): number | Response {
  let parsed = Number.parseInt(value, 10)

  if (!Number.isInteger(parsed) || String(parsed) !== value) {
    return Response.json(
      { error: `${name} must be an integer.` },
      { status: 400 },
    )
  }

  return parsed
}

function unauthorized() {
  return Response.json({ error: "Authentication required." }, { status: 401 })
}

function authUserId(auth: { identity: unknown }) {
  return (auth.identity as { id: number }).id
}

function validationError(
  issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<unknown> }>,
) {
  return Response.json(
    {
      error: "Validation failed.",
      fieldErrors: fieldErrorsFromIssues(issues),
      issues,
    },
    { status: 400 },
  )
}

function wantsJson(request: Request) {
  let accept = request.headers.get("accept") ?? ""
  return accept.includes("application/json") && !accept.includes("text/html")
}

function downloadFilename(scheduleName: string) {
  let slug = scheduleName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  return `${slug || "schedule"}.ics`
}

function fieldError(field: string, message: string, status: number) {
  return Response.json(
    {
      error: message,
      fieldErrors: {
        [field]: message,
      },
    },
    { status },
  )
}

function fieldErrorsFromIssues(
  issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<unknown> }>,
) {
  let fieldErrors: Record<string, string> = {}

  for (let issue of issues) {
    let field = issue.path?.[0]
    if (typeof field !== "string" || field in fieldErrors) continue

    fieldErrors[field] = fieldMessage(field, issue.message)
  }

  return fieldErrors
}

function fieldMessage(field: string, message: string) {
  if (field !== "name") return message

  if (/80|maximum|max|at most|length/i.test(message)) {
    return "Name must be 80 characters or fewer."
  }

  if (/required|minimum|min|at least|empty/i.test(message)) {
    return "Name is required."
  }

  return message
}

function handleCreateScheduleError(error: unknown): Response {
  if (error instanceof ScheduleDataError && error.message === "Name must be unique.") {
    return fieldError("name", error.message, error.status)
  }

  if (error instanceof DataTableConstraintError) {
    return fieldError("name", "Name must be unique.", 409)
  }

  return handleScheduleError(error)
}

function handleScheduleError(error: unknown): Response {
  if (error instanceof ScheduleDataError) {
    return Response.json({ error: error.message }, { status: error.status })
  }

  if (error instanceof DataTableConstraintError) {
    return Response.json(
      { error: "Schedule data conflicts with an existing record." },
      { status: 409 },
    )
  }

  throw error
}
