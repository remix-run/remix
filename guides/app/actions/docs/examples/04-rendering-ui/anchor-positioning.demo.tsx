import { css, ref } from "remix/ui";
import { anchor } from "remix/ui/anchor";
import button from "remix/ui/button";

/**
 * @name Anchor
 * @description Position a floating element against an anchor with the low-level anchor primitive.
 * @layout center
 */
export function AnchorPositioning() {
  let anchorNode: HTMLElement | null = null;
  let floatingNode: HTMLElement | null = null;
  let cleanupAnchor = () => {};

  function positionFloating() {
    cleanupAnchor();

    if (anchorNode && floatingNode) {
      cleanupAnchor = anchor(floatingNode, anchorNode, {
        placement: "bottom-start",
        offset: 8,
      });
    }
  }

  function clearFloating() {
    cleanupAnchor();
    cleanupAnchor = () => {};
  }

  return () => (
    <div mix={demoCss}>
      <button
        mix={[
          button(),
          ref((node, signal) => {
            if (!(node instanceof HTMLElement)) return;

            anchorNode = node;
            positionFloating();

            signal.addEventListener("abort", () => {
              if (anchorNode === node) {
                anchorNode = null;
              }

              clearFloating();
            });
          }),
        ]}
      >
        Anchor target
      </button>

      <div
        mix={[
          floatingCss,
          ref((node, signal) => {
            if (!(node instanceof HTMLElement)) return;

            floatingNode = node;
            positionFloating();

            signal.addEventListener("abort", () => {
              if (floatingNode === node) {
                floatingNode = null;
              }

              clearFloating();
            });
          }),
        ]}
      >
        Positioned surface
      </div>
    </div>
  );
}

const demoCss = css({
  display: "grid",
  placeItems: "center",
  minHeight: "9rem",
  width: "min(100%, 24rem)",
});

const floatingCss = css({
  boxSizing: "border-box",
  width: "12rem",
  border: "1px solid rgba(0, 0, 0, 0.12)",
  borderRadius: "8px",
  background: "#FFFFFF",
  boxShadow: "0 12px 32px rgba(0, 0, 0, 0.12)",
  color: "#101010",
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: "13px",
  lineHeight: "18px",
  fontWeight: 500,
  letterSpacing: 0,
  padding: "10px 12px",
});
