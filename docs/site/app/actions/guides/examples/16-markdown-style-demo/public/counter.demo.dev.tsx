import { css, on } from "remix/component";
import type { Handle } from "remix/component";

export function Counter(handle: Handle) {
  let count = 3;

  return () => (
    <div
      mix={css({
        display: "grid",
        gap: "var(--rmx-space-lg)",
        placeItems: "center",
      })}
    >
      <p
        mix={css({
          margin: "0",
          color: "var(--rmx-color-accent)",
          fontSize: "calc(var(--rmx-font-size-page-title) * 2)",
          fontWeight: "var(--rmx-font-weight-bold)",
          lineHeight: "var(--rmx-line-height-tight)",
          letterSpacing: "var(--rmx-letter-spacing-tight)",
        })}
      >
        {count}
      </p>
      <div
        mix={css({
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--rmx-space-md)",
        })}
      >
        <button
          mix={[
            on("click", () => {
              count--;
              handle.update();
            }),
            buttonStyles,
          ]}
          type="button"
        >
          Decrement
        </button>
        <button
          mix={[
            on("click", () => {
              count++;
              handle.update();
            }),
            buttonStyles,
          ]}
          type="button"
        >
          Increment
        </button>
      </div>
    </div>
  );
}

const buttonStyles = css({
  appearance: "none",
  border: "var(--rmx-space-px) solid var(--rmx-color-action-primary-border)",
  borderRadius: "var(--rmx-radius-full)",
  background: "var(--rmx-color-action-primary-background)",
  color: "var(--rmx-color-action-primary-foreground)",
  cursor: "pointer",
  font: "inherit",
  fontWeight: "var(--rmx-font-weight-bold)",
  lineHeight: "1",
  padding: "var(--rmx-space-sm) var(--rmx-space-lg)",
  "&:hover": {
    filter: "brightness(0.95)",
  },
});
