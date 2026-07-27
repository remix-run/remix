import { css, type Handle } from "remix/ui";
import { draggable } from "./draggable.tsx";

export function DraggableMixinDemo(_handle: Handle) {
  return () => (
    <main mix={pageStyle}>
      <h1>Draggable mixin demo</h1>
      <p>Drag the box with your mouse or trackpad.</p>
      <div mix={canvasStyle}>
        <div
          mix={[boxStyle, draggable(true)]}
          // `draggable` reads and writes inline `left`/`top`, so the starting
          // offsets have to live in the style prop.
          style={{ left: "24px", top: "24px" }}
        >
          drag me
        </div>
      </div>
    </main>
  );
}

const pageStyle = css({ fontFamily: "system-ui, sans-serif", padding: "24px" });

const canvasStyle = css({
  position: "relative",
  width: "100%",
  maxWidth: "720px",
  height: "420px",
  border: "1px dashed #c2c2c2",
  borderRadius: "8px",
  overflow: "hidden",
  backgroundColor: "#fafafa",
});

const boxStyle = css({
  position: "absolute",
  width: "180px",
  padding: "14px 16px",
  borderRadius: "10px",
  backgroundColor: "#2563eb",
  color: "white",
  boxShadow: "0 8px 20px rgba(37, 99, 235, 0.35)",
  userSelect: "none",
  touchAction: "none",
  cursor: "grab",
});
