import * as popover from "@remix-run/ui/popover";
import * as select from "@remix-run/ui/select";
import { clientEntry, css, unsafeHTML } from "remix/component";
import type { Handle } from "remix/component";

export type InstallTabsPanel = {
  value: string;
  label: string;
  // Highlighted code block HTML for this package manager's script.
  html: string;
};

export const InstallTabs = clientEntry(
  import.meta.url,
  function InstallTabs(handle: Handle<{ panels: InstallTabsPanel[] }>) {
    let selected = handle.props.panels[0]?.value;

    return () => {
      let { panels } = handle.props;

      return (
        <div mix={styles.root}>
          <div mix={styles.header}>
            <select.Context defaultLabel={panels[0]?.label} defaultValue={panels[0]?.value}>
              <button
                type="button"
                aria-label="Package manager"
                mix={[
                  select.trigger(),
                  styles.trigger,
                  select.onSelectChange((event) => {
                    selected = event.value ?? selected;
                    handle.update();
                  }),
                ]}
              >
                <SelectedLabel />
                <ChevronDownIcon />
              </button>
              <popover.Context>
                <div mix={[select.popover(), styles.surface]}>
                  <div aria-label="Package managers" mix={[select.list(), styles.list]}>
                    {panels.map((panel) => (
                      <div
                        key={panel.value}
                        mix={[
                          select.option({ label: panel.label, value: panel.value }),
                          styles.option,
                        ]}
                      >
                        {panel.label}
                      </div>
                    ))}
                  </div>
                </div>
              </popover.Context>
            </select.Context>
          </div>
          {panels.map((panel) => (
            <div
              key={panel.value}
              class="docs-code-tabs-panel"
              hidden={panel.value !== selected}
              innerHTML={unsafeHTML(panel.html)}
            />
          ))}
        </div>
      );
    };
  },
);

function SelectedLabel(handle: Handle) {
  let context = handle.context.get(select.Context);
  return () => <span>{context.displayedLabel}</span>;
}

function ChevronDownIcon() {
  return () => (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" />
    </svg>
  );
}

const styles = {
  root: css({
    overflow: "clip",
    margin: "var(--rmx-space-lg) 0",
    border: "1px solid var(--rmx-color-border-subtle)",
    borderRadius: "var(--rmx-radius-md)",
    background: "var(--rmx-color-code-background)",
  }),
  header: css({
    display: "flex",
    borderBottom: "1px solid var(--rmx-color-border-subtle)",
    background: "var(--rmx-surface-lvl2)",
  }),
  trigger: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--rmx-space-sm)",
    padding: "var(--rmx-space-sm) var(--rmx-space-md)",
    border: 0,
    borderRadius: 0,
    background: "none",
    color: "var(--rmx-color-text-primary)",
    font: "inherit",
    fontSize: "var(--rmx-font-size-sm)",
    fontWeight: 600,
    cursor: "pointer",
    "&:hover": {
      background: "var(--rmx-color-code-background)",
    },
    "&:focus-visible": {
      outline: "2px solid currentColor",
      outlineOffset: "-2px",
    },
  }),
  surface: css({
    margin: 0,
    padding: "var(--rmx-space-xs)",
    minWidth: "8rem",
    border: "1px solid var(--rmx-color-border-subtle)",
    borderRadius: "var(--rmx-radius-md)",
    background: "var(--rmx-surface-lvl2)",
    color: "var(--rmx-color-text-primary)",
    boxShadow: "0 12px 32px #00000024",
    fontSize: "var(--rmx-font-size-sm)",
    opacity: 0,
    transition: "opacity 140ms ease, display 140ms allow-discrete, overlay 140ms allow-discrete",
    "&:popover-open": {
      opacity: 1,
      "@starting-style": {
        opacity: 0,
      },
    },
    "@media (prefers-reduced-motion: reduce)": {
      transition: "none",
    },
  }),
  list: css({
    display: "grid",
    gap: "2px",
    outline: 0,
  }),
  option: css({
    padding: "var(--rmx-space-xs) var(--rmx-space-sm)",
    borderRadius: "var(--rmx-radius-sm)",
    cursor: "default",
    '&[data-highlighted="true"]': {
      background: "var(--rmx-color-code-background)",
    },
    '&[aria-selected="true"]': {
      fontWeight: 600,
    },
  }),
};
