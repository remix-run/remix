import * as React from "react";
import cx from "clsx";

const MaxContainer = React.forwardRef<HTMLDivElement, MaxContainerProps>(
  ({ children, className, ...props }, forwardedRef) => {
    return (
      <div
        ref={forwardedRef}
        className={cx(className, "ui--max-container")}
        {...props}
      >
        {children}
      </div>
    );
  }
);
MaxContainer.displayName = "MaxContainer";

interface MaxContainerOwnProps {}

interface MaxContainerProps
  extends MaxContainerOwnProps,
    Omit<React.ComponentPropsWithRef<"div">, keyof MaxContainerOwnProps> {}

export type { MaxContainerProps };
export { MaxContainer };
