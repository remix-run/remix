import { css } from "remix/ui";
import { theme } from "remix/ui/theme";

import type { ScheduleDocument } from "../../data/schedules.ts";
import type { Schedule } from "../../data/schema.ts";
import { routes } from "../../routes.ts";
import { Document } from "../../ui/document.tsx";
import { ScheduleGrid, type GridScheduleDocument } from "../../ui/schedule-grid.tsx";
import { ScheduleSidebar } from "../../ui/schedule-sidebar.tsx";

export function SchedulePage() {
  return ({
    activeScheduleId,
    csrfToken,
    schedules,
    schedule,
  }: {
    activeScheduleId?: number;
    csrfToken: string;
    schedules: Schedule[];
    schedule?: ScheduleDocument;
  }) => (
    <Document title="Timebox Ai">
      <div mix={appShellStyle}>
        <ScheduleSidebar
          activeScheduleId={activeScheduleId}
          csrfToken={csrfToken}
          logoutHref={routes.auth.logout.href()}
          schedules={schedules.map((schedule) => ({
            deleteHref: routes.schedules.destroy.href({
              scheduleId: String(schedule.id),
            }),
            href: routes.schedules.show.href({
              scheduleId: String(schedule.id),
            }),
            id: schedule.id,
            name: schedule.name,
          }))}
        />

        <main aria-label="Workspace" mix={workspaceStyle}>
          {schedule ? (
            <ScheduleGrid
              csrfToken={csrfToken}
              downloadIcsHref={routes.schedules.downloadIcs.href({
                scheduleId: String(schedule.id),
              })}
              schedule={schedule as GridScheduleDocument}
            />
          ) : (
            <div mix={emptyWorkspaceStyle}>Create a schedule to get started.</div>
          )}
        </main>
      </div>
    </Document>
  );
}

const appShellStyle = css({
  backgroundColor: theme.surface.lvl0,
  display: "grid",
  gridTemplateColumns: "240px minmax(0, 1fr)",
  height: "100vh",
  overflow: "hidden",
});

const workspaceStyle = css({
  minHeight: 0,
  overflow: "hidden",
});

const emptyWorkspaceStyle = css({
  alignItems: "center",
  color: theme.colors.text.secondary,
  display: "flex",
  fontSize: theme.fontSize.lg,
  height: "100%",
  justifyContent: "center",
});
