import { css, on, ref } from "remix/ui";
import type { Handle } from "remix/ui";
import { spring } from "remix/ui/animation";
import type { SpringPreset } from "remix/ui/animation";

import { dragVelocityEvents } from "./gallery/drag-release.browser.ts";

const stageWidth = 420;
const stageHeight = 260;
const dotSize = 56;
const dotRadius = dotSize / 2;

export function SpringDragReleaseDemo(handle: Handle) {
  let stage: HTMLDivElement;
  let targetX = 310;
  let targetY = 130;
  let dotX = 110;
  let dotY = 130;
  let selectedPreset: SpringPreset = "bouncy";
  let dragging = false;
  let animating = false;
  let ignoreNextStageClick = false;
  let transitionX = String(spring(selectedPreset));
  let transitionY = String(spring(selectedPreset));

  function setTarget(event: PointerEvent | MouseEvent) {
    if (ignoreNextStageClick) {
      ignoreNextStageClick = false;
      return;
    }

    let rect = stage.getBoundingClientRect();
    targetX = clamp(
      event.clientX - rect.left,
      dotRadius,
      rect.width - dotRadius,
    );
    targetY = clamp(
      event.clientY - rect.top,
      dotRadius,
      rect.height - dotRadius,
    );
    handle.update();
  }

  function setDotPosition(event: PointerEvent) {
    let rect = stage.getBoundingClientRect();
    dotX = clamp(event.clientX - rect.left, dotRadius, rect.width - dotRadius);
    dotY = clamp(event.clientY - rect.top, dotRadius, rect.height - dotRadius);
  }

  return () => (
    <div mix={layoutStyle}>
      <div
        mix={[
          stageStyle,
          ref((node: HTMLDivElement) => {
            stage = node;
          }),
          on<HTMLDivElement, "click">("click", setTarget),
        ]}
      >
        <div
          aria-hidden="true"
          mix={targetStyle}
          style={{
            left: `${targetX}px`,
            top: `${targetY}px`,
            transition: `left ${spring(selectedPreset)}, top ${spring(selectedPreset)}`,
          }}
        />

        <div
          aria-label="Draggable spring dot"
          role="button"
          tabIndex={0}
          mix={[
            dotStyle,
            dragVelocityEvents(),
            on<HTMLDivElement, "pointerdown">("pointerdown", (event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              dragging = true;
              animating = false;
              ignoreNextStageClick = true;
              setDotPosition(event);
              handle.update();
            }),
            on<HTMLDivElement, "pointermove">("pointermove", (event) => {
              if (!dragging) return;
              setDotPosition(event);
              handle.update();
            }),
            on(dragVelocityEvents.release, (event) => {
              dragging = false;

              let distanceX = targetX - dotX;
              let distanceY = targetY - dotY;
              transitionX = readVelocitySpring(
                selectedPreset,
                event.velocityX,
                distanceX,
              );
              transitionY = readVelocitySpring(
                selectedPreset,
                event.velocityY,
                distanceY,
              );

              animating = true;
              dotX = targetX;
              dotY = targetY;
              handle.update();
            }),
            on<HTMLDivElement, "transitionend">("transitionend", () => {
              animating = false;
              handle.update();
            }),
          ]}
          style={{
            left: `${dotX}px`,
            top: `${dotY}px`,
            cursor: dragging ? "grabbing" : "grab",
            transition: animating
              ? `left ${transitionX}, top ${transitionY}`
              : "none",
          }}
        />
      </div>

      <div class="spring-demo-controls" mix={controlsStyle}>
        {(Object.keys(spring.presets) as SpringPreset[]).map((preset) => (
          <label key={preset} mix={controlLabelStyle}>
            <input
              type="radio"
              name="spring-preset"
              value={preset}
              checked={selectedPreset === preset}
              mix={on<HTMLInputElement, "change">("change", () => {
                selectedPreset = preset;
                transitionX = String(spring(selectedPreset));
                transitionY = String(spring(selectedPreset));
                handle.update();
              })}
            />
            {preset}
          </label>
        ))}
      </div>

      <p mix={hintStyle}>
        Click the panel to move the target. Drag and release the dot.
      </p>
    </div>
  );
}

function readVelocitySpring(
  preset: SpringPreset,
  velocity: number,
  distance: number,
): string {
  if (Math.abs(distance) < 1) {
    return String(spring(preset));
  }

  let normalizedVelocity = clamp(velocity / distance, -20, 20);
  return String(spring(preset, { velocity: normalizedVelocity }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const layoutStyle = css({
  display: "grid",
  gap: "0.75rem",
  width: "min(100%, 30rem)",
});

const stageStyle = css({
  position: "relative",
  overflow: "hidden",
  width: "100%",
  maxWidth: `${stageWidth}px`,
  height: `${stageHeight}px`,
  borderRadius: "18px",
  background:
    "radial-gradient(circle at 20% 20%, rgba(14, 165, 233, 0.2), transparent 35%), #17172a",
  cursor: "crosshair",
  touchAction: "none",
});

const targetStyle = css({
  position: "absolute",
  width: `${dotSize + 18}px`,
  height: `${dotSize + 18}px`,
  border: "2px dashed rgba(233, 69, 96, 0.65)",
  borderRadius: "50%",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
});

const dotStyle = css({
  position: "absolute",
  width: `${dotSize}px`,
  height: `${dotSize}px`,
  borderRadius: "50%",
  backgroundColor: "#0ea5e9",
  boxShadow: "0 0 20px rgba(14, 165, 233, 0.45)",
  transform: "translate(-50%, -50%)",
  userSelect: "none",
  touchAction: "none",
  "&:focus-visible": {
    outline: "3px solid rgba(255, 255, 255, 0.8)",
    outlineOffset: "3px",
  },
});

const controlsStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "0.35rem",
});

const controlLabelStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  border: "1px solid #d1d5db",
  borderRadius: "999px",
  padding: "0.4rem 0.65rem",
  fontSize: "0.85rem",
});

const hintStyle = css({
  margin: 0,
  color: "#6b7280",
  fontSize: "0.85rem",
  textAlign: "center",
});
