import * as React from "react";
import cx from "clsx";
import { IconX } from "~/ui/icons";

export function Token({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span className={cx(className, "ui--token")} {...props}>
      {children}
    </span>
  );
}

export function TokenDismissButton({
  children,
  className,
  type = "button",
  ...props
}: React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      aria-label="Dismiss"
      className={cx(className, "ui--token__dismiss-button")}
      type={type}
      {...props}
    >
      <IconX className={cx(className, "ui--token__dismiss-icon")} />
    </button>
  );
}
