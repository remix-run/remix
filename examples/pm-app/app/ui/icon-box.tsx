import * as React from "react";
import cx from "clsx";

function IconBox({
  icon,
  className
}: {
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        className,
        "flex items-center justify-center flex-grow-0 flex-shrink-0",
        {
          "w-12": !(className && /\bw-[\d]/g.test(className)),
          "h-12": !(className && /\bh-[\d]/g.test(className)),
          "bg-current": !(className && /\bbg-[a-zA-Z]/g.test(className)),
          "rounded-lg": !(
            className && /\b(rounded[-\s]|rounded$)/g.test(className)
          )
        }
      )}
    >
      {icon}
    </div>
  );
}

export { IconBox };
