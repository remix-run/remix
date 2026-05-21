import type { ScheduleDocument } from "../../data/schedules.ts"

const calendarProductId = "-//Timebox AI//Schedule Export//EN"
const dayCodes = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const
const referenceMonday = Date.UTC(2026, 0, 5)

export function createScheduleIcs(schedule: ScheduleDocument, now = new Date()) {
  let lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${calendarProductId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(schedule.name)}`,
  ]

  for (let block of schedule.blocks) {
    let dayCode = dayCodes[block.dayOfWeek]
    if (!dayCode) continue

    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(`${schedule.id}-${block.id}@timebox-ai`)}`,
      `DTSTAMP:${formatUtcDateTime(now)}`,
      `SUMMARY:${escapeIcsText(block.name)}`,
      `DTSTART:${formatFloatingDateTime(block.dayOfWeek, block.startMinute)}`,
      `DTEND:${formatFloatingDateTime(block.dayOfWeek, block.endMinute)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${dayCode}`,
      "END:VEVENT",
    )
  }

  lines.push("END:VCALENDAR")

  return `${foldIcsLines(lines).join("\r\n")}\r\n`
}

function formatFloatingDateTime(dayOfWeek: number, minuteOfDay: number) {
  let date = new Date(referenceMonday + dayOfWeek * 24 * 60 * 60 * 1000)
  let hour = Math.floor(minuteOfDay / 60)
  let minute = minuteOfDay % 60

  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "T",
    pad(hour),
    pad(minute),
    "00",
  ].join("")
}

function formatUtcDateTime(date: Date) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "T",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    "Z",
  ].join("")
}

function escapeIcsText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\n")
}

function foldIcsLines(lines: string[]) {
  return lines.flatMap((line) => {
    let folded = [line.slice(0, 75)]
    let remaining = line.slice(75)

    while (remaining.length > 0) {
      folded.push(` ${remaining.slice(0, 74)}`)
      remaining = remaining.slice(74)
    }

    return folded
  })
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}
