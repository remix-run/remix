import { css } from "remix/component";
import type { Handle } from "remix/component";
import { spring } from "@remix-run/ui/animation";
import { press } from "@remix-run/ui/press";

export function PressStateDemo(handle: Handle) {
  let pressed = false;

  function setPressed(nextPressed: boolean) {
    if (pressed === nextPressed) return;
    pressed = nextPressed;
    handle.update();
  }

  return () => (
    <div
      tabIndex={0}
      mix={[
        press({
          activate: false,
          onPressStart() {
            setPressed(true);
          },
          onPressEnd() {
            setPressed(false);
          },
        }),
        css({
          display: "grid",
          width: 120,
          height: 120,
          placeItems: "center",
          borderRadius: 12,
          backgroundColor: "#9911ff",
          color: "white",
          cursor: "pointer",
          fontWeight: "800",
          transition: `transform ${spring()}`,
          "&:focus": {
            outline: "4px solid rgba(0,120,255,0.7)",
            outlineOffset: 2,
          },
          "&:hover, &:focus": {
            transform: "scale(1.12)",
          },
        }),
      ]}
    >
      <span>{pressed ? "Pressed" : "Press me"}</span>
    </div>
  );
}
