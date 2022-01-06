import cx from "clsx";
export function Note({
  children,
  className
}: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cx(className, "ui--note")}>{children}</div>;
}
