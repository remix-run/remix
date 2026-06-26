import { Button } from "remix/components/button";
import { css } from "remix/ui";

export function ButtonComponent() {
  return () => (
    <div mix={buttonRowCss}>
      <Button tone="primary" type="submit">
        Save
      </Button>
      <Button tone="secondary">Secondary</Button>
      <Button tone="ghost">Ghost</Button>
      <Button tone="danger">Delete</Button>
    </div>
  );
}

const buttonRowCss = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
});
