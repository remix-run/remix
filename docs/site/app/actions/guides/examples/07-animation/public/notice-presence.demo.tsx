import { css, on } from "remix/component";
import type { Handle } from "remix/component";
import { animateEntrance, animateExit, spring } from "@remix-run/ui/animation";

export function NoticePresenceDemo(handle: Handle) {
  let visible = true;

  return () => (
    <div
      mix={css({
        display: "grid",
        gap: "1rem",
        minWidth: "16rem",
      })}
    >
      <button
        mix={[
          on("click", () => {
            visible = !visible;
            handle.update();
          }),
          css({
            border: "1px solid #d83a5a",
            borderRadius: "999px",
            background: "#d83a5a",
            color: "white",
            cursor: "pointer",
            font: "inherit",
            fontWeight: "700",
            padding: "0.7rem 1rem",
          }),
        ]}
        type="button"
      >
        Toggle notice
      </button>

      {visible && (
        <p
          key="notice"
          mix={[
            animateEntrance({
              opacity: 0,
              transform: "translateY(8px)",
              ...spring("snappy"),
            }),
            animateExit({
              opacity: 0,
              transform: "translateY(-8px)",
              ...spring("snappy"),
            }),
            css({
              margin: 0,
              borderRadius: "12px",
              background: "#ecfdf5",
              color: "#065f46",
              padding: "0.75rem 1rem",
            }),
          ]}
        >
          Settings saved.
        </p>
      )}
    </div>
  );
}
